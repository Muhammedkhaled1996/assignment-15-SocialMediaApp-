"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wholesaleService = exports.WholesaleService = void 0;
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../common/utils");
class WholesaleService {
    async createPartner(payload, req) {
        const code = payload.code.toUpperCase().trim();
        const exists = await module_1.WholesalePartnerModel.findOne({ code });
        if (exists)
            throw new exception_1.ConflictException(`Wholesale partner ${code} already exists`);
        const partner = await module_1.WholesalePartnerModel.create({
            ...payload,
            code,
            createdBy: req.user?._id,
        });
        await service_1.auditService.record({
            req,
            action: "WHOLESALE_PARTNER_CREATED",
            module: "wholesale",
            entityType: "WholesalePartner",
            entityId: partner._id.toString(),
            newValues: partner.toObject(),
        });
        return partner;
    }
    async createWholesaleContract(payload, req) {
        const branchId = (0, middleware_1.assertBranchAccess)(req.branchContext, payload.branchId);
        return await (0, utils_1.withTransaction)(async (session) => {
            const partner = await module_1.WholesalePartnerModel.findById(payload.partnerId, null, session ? { session } : undefined);
            if (!partner)
                throw new exception_1.NotFoundException("Wholesale partner not found");
            const tripInfo = await module_1.TripModel.findById(payload.tripId, null, session ? { session } : undefined);
            if (!tripInfo)
                throw new exception_1.NotFoundException("Trip not found");
            const seatQuantity = payload.allocationType === "ENTIRE_TRIP" ? tripInfo.availableInventory : Math.floor(payload.seatQuantity);
            if (seatQuantity < 1) {
                throw new exception_1.BadRequestException("Wholesale seat quantity must be at least 1");
            }
            const updatedTrip = await module_1.TripModel.findOneAndUpdate({
                _id: tripInfo._id,
                availableInventory: { $gte: seatQuantity },
            }, {
                $inc: {
                    availableInventory: -seatQuantity,
                    wholesaleAllocatedSeats: seatQuantity,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!updatedTrip) {
                throw new exception_1.InsufficientInventoryError(`Insufficient available trip inventory (${tripInfo.availableInventory}) for wholesale allocation of ${seatQuantity} seats`);
            }
            const unitPriceEgp = utils_1.Money.round(payload.unitPriceEgp);
            const totalContractPriceEgp = utils_1.Money.multiply(unitPriceEgp, seatQuantity);
            const depositAmountEgp = utils_1.Money.round(payload.depositAmountEgp || 0);
            const contractNumber = payload.contractNumber?.toUpperCase().trim() ||
                (await service_1.sequenceService.nextReference({
                    documentType: "WHOLESALE",
                    prefix: "WSL",
                    session,
                }));
            const [contract] = await module_1.WholesaleContractModel.create([
                {
                    contractNumber,
                    partnerId: partner._id,
                    tripId: updatedTrip._id,
                    branchId,
                    allocationType: payload.allocationType || "SEAT_BLOCK",
                    seatQuantity,
                    releasedSeats: 0,
                    unitPriceEgp,
                    totalContractPriceEgp,
                    depositAmountEgp,
                    paidAmountEgp: 0,
                    remainingBalanceEgp: totalContractPriceEgp,
                    paymentSchedule: payload.paymentSchedule || [],
                    attachments: payload.attachments || [],
                    status: "ACTIVE",
                    notes: payload.notes,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            partner.totalContractedAmount = utils_1.Money.add(partner.totalContractedAmount, totalContractPriceEgp);
            partner.currentBalance = utils_1.Money.subtract(partner.totalContractedAmount, partner.totalPaidAmount);
            await partner.save(session ? { session } : undefined);
            await module_1.InventoryMovementModel.create([
                {
                    tripId: updatedTrip._id,
                    branchId,
                    action: "WHOLESALE_ALLOCATE",
                    quantity: seatQuantity,
                    referenceId: contractNumber,
                    notes: `Wholesale allocation (${contractNumber}) to ${partner.companyNameEn}`,
                    actorId: req.user?._id,
                },
            ], session ? { session } : undefined);
            await service_1.auditService.record({
                req,
                action: "WHOLESALE_CONTRACT_CREATED",
                module: "wholesale",
                entityType: "WholesaleContract",
                entityId: contract._id.toString(),
                branchId,
                newValues: contract.toObject(),
                session,
            });
            return contract;
        });
    }
    async releaseWholesaleSeats(contractId, quantityToRelease, req) {
        const qty = Math.floor(quantityToRelease);
        if (qty < 1)
            throw new exception_1.BadRequestException("Quantity to release must be at least 1");
        return await (0, utils_1.withTransaction)(async (session) => {
            const contract = await module_1.WholesaleContractModel.findById(contractId, null, session ? { session } : undefined);
            if (!contract)
                throw new exception_1.NotFoundException("Wholesale contract not found");
            const activeLocked = contract.seatQuantity - contract.releasedSeats;
            if (qty > activeLocked) {
                throw new exception_1.BadRequestException(`Cannot release ${qty} seats; only ${activeLocked} seats are currently locked`);
            }
            const partner = await module_1.WholesalePartnerModel.findById(contract.partnerId, null, session ? { session } : undefined);
            const reductionAmount = utils_1.Money.multiply(contract.unitPriceEgp, qty);
            contract.releasedSeats += qty;
            contract.totalContractPriceEgp = utils_1.Money.subtract(contract.totalContractPriceEgp, reductionAmount);
            contract.remainingBalanceEgp = Math.max(0, utils_1.Money.subtract(contract.totalContractPriceEgp, contract.paidAmountEgp));
            contract.status = contract.releasedSeats === contract.seatQuantity ? "CANCELLED" : "PARTIALLY_RELEASED";
            await contract.save(session ? { session } : undefined);
            if (partner) {
                partner.totalContractedAmount = Math.max(0, utils_1.Money.subtract(partner.totalContractedAmount, reductionAmount));
                partner.currentBalance = Math.max(0, utils_1.Money.subtract(partner.totalContractedAmount, partner.totalPaidAmount));
                await partner.save(session ? { session } : undefined);
            }
            await module_1.TripModel.updateOne({ _id: contract.tripId }, {
                $inc: {
                    availableInventory: qty,
                    wholesaleAllocatedSeats: -qty,
                },
            }, session ? { session } : undefined);
            await module_1.InventoryMovementModel.create([
                {
                    tripId: contract.tripId,
                    branchId: contract.branchId,
                    action: "WHOLESALE_RELEASE",
                    quantity: qty,
                    referenceId: contract.contractNumber,
                    notes: `Released ${qty} wholesale seats back to retail inventory`,
                    actorId: req.user?._id,
                },
            ], session ? { session } : undefined);
            await service_1.auditService.record({
                req,
                action: "WHOLESALE_SEATS_RELEASED",
                module: "wholesale",
                entityType: "WholesaleContract",
                entityId: contract._id.toString(),
                branchId: contract.branchId,
                newValues: contract.toObject(),
                session,
            });
            return contract;
        });
    }
}
exports.WholesaleService = WholesaleService;
exports.wholesaleService = new WholesaleService();
