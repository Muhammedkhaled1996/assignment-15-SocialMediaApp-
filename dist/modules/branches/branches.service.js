"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.branchService = exports.BranchService = exports.BranchRepository = void 0;
const module_1 = require("../../DB/module");
const base_repository_1 = require("../../common/repository/base.repository");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
class BranchRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.BranchModel);
    }
}
exports.BranchRepository = BranchRepository;
class BranchService {
    repo = new BranchRepository();
    async ensureDefaultCompanyAndHQBranch() {
        let company = await module_1.CompanyModel.findOne({ code: "TROZIANA" });
        if (!company) {
            company = await module_1.CompanyModel.create({
                nameAr: "شركة تروزيانا للسياحة",
                nameEn: "Troziana Travel & Tourism",
                code: "TROZIANA",
                baseCurrency: "EGP",
                status: "ACTIVE",
            });
        }
        let hqBranch = await module_1.BranchModel.findOne({ code: "HQ-CAI" });
        if (!hqBranch) {
            hqBranch = await module_1.BranchModel.create({
                companyId: company._id,
                code: "HQ-CAI",
                nameAr: "الفرع الرئيسي - القاهرة",
                nameEn: "Cairo Headquarters",
                governorate: "Cairo",
                city: "Cairo",
                isHeadquarters: true,
                status: "ACTIVE",
            });
        }
        return { company, hqBranch };
    }
    async createBranch(payload, req) {
        const code = payload.code.toUpperCase().trim();
        const exists = await this.repo.findOne({ filter: { code } });
        if (exists) {
            throw new exception_1.ConflictException(`Branch with code ${code} already exists`);
        }
        const { company } = await this.ensureDefaultCompanyAndHQBranch();
        const branch = await this.repo.createOne({
            data: {
                ...payload,
                code,
                companyId: payload.companyId || company._id,
                createdBy: req.user?._id,
            },
        });
        await service_1.auditService.record({
            req,
            action: "BRANCH_CREATED",
            module: "branches",
            entityType: "Branch",
            entityId: branch._id.toString(),
            branchId: branch._id,
            newValues: branch.toObject(),
        });
        return branch;
    }
    async listBranches(query, req) {
        const filter = {};
        if (query.status)
            filter.status = query.status;
        if (query.governorate)
            filter.governorate = query.governorate;
        if (!req.branchContext?.isCentralAdmin) {
            const scoped = (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, query.branchId, "_id");
            Object.assign(filter, scoped);
        }
        return await this.repo.paginate({
            filter,
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 25,
        });
    }
    async getBranchById(id, req) {
        const filter = { _id: id };
        if (!req.branchContext?.isCentralAdmin) {
            const scoped = (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, id, "_id");
            Object.assign(filter, scoped);
        }
        const branch = await this.repo.findOne({ filter });
        if (!branch) {
            throw new exception_1.NotFoundException("Branch not found");
        }
        return branch;
    }
    async updateBranch(id, payload, req) {
        const existing = await this.getBranchById(id, req);
        const updated = await this.repo.findByIdAndUpdate({
            id,
            data: { ...payload, updatedBy: req.user?._id },
        });
        await service_1.auditService.record({
            req,
            action: "BRANCH_UPDATED",
            module: "branches",
            entityType: "Branch",
            entityId: id,
            branchId: id,
            previousValues: existing.toObject(),
            newValues: updated?.toObject(),
        });
        return updated;
    }
}
exports.BranchService = BranchService;
exports.branchService = new BranchService();
exports.default = exports.branchService;
