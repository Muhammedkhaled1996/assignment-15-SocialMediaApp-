import { Request } from "express";
import { FlightLotModel, GroupModel, TripModel } from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import { BadRequestException, ConflictException, InsufficientInventoryError, NotFoundException } from "../../common/exception";
import { auditService, sequenceService } from "../../common/service";
import { withTransaction } from "../../common/utils";

export class TripRepository extends DatabaseRepository<any> {
  constructor() {
    super(TripModel);
  }
}

export class TripService {
  private repo = new TripRepository();

  async createTrip(payload: any, req: Request) {
    const depDate = new Date(payload.departureDate);
    const retDate = new Date(payload.returnDate);
    if (retDate < depDate) {
      throw new BadRequestException("Return date cannot be earlier than departure date");
    }

    return await withTransaction(async (session) => {
      const code =
        payload.code?.toUpperCase().trim() ||
        (await sequenceService.nextReference({
          documentType: "TRIP",
          prefix: "TRP",
          session,
        }));

      const exists = await TripModel.findOne({ code }, null, session ? { session } : undefined);
      if (exists) {
        throw new ConflictException(`Trip with code ${code} already exists`);
      }

      if (Array.isArray(payload.flightAllocations) && payload.flightAllocations.length > 0) {
        for (const alloc of payload.flightAllocations) {
          const updatedLot = await FlightLotModel.findOneAndUpdate(
            {
              _id: alloc.flightLotId,
              status: "ACTIVE",
              availableSeats: { $gte: alloc.allocatedSeats },
            },
            {
              $inc: {
                availableSeats: -alloc.allocatedSeats,
                reservedSeats: alloc.allocatedSeats,
              },
            },
            { returnDocument: "after", ...(session ? { session } : {}) },
          );
          if (!updatedLot) {
            throw new InsufficientInventoryError(
              `Flight lot ${alloc.flightLotId} does not have ${alloc.allocatedSeats} available seats`,
            );
          }
        }
      }

      const capacity = Number(payload.capacity);
      const [trip] = await TripModel.create(
        [
          {
            ...payload,
            code,
            departureDate: depDate,
            returnDate: retDate,
            capacity,
            availableInventory: capacity,
            allocatedToBranchesSeats: 0,
            wholesaleAllocatedSeats: 0,
            reservedSeats: 0,
            confirmedSoldSeats: 0,
            createdBy: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      await auditService.record({
        req,
        action: "TRIP_CREATED",
        module: "trips",
        entityType: "Trip",
        entityId: trip!._id.toString(),
        newValues: trip!.toObject(),
        session,
      });

      return trip!;
    });
  }

  async createGroup(payload: any, req: Request) {
    const trip = await TripModel.findById(payload.tripId);
    if (!trip) throw new NotFoundException("Trip not found");

    const code = payload.code.toUpperCase().trim();
    const exists = await GroupModel.findOne({ code });
    if (exists) throw new ConflictException(`Group ${code} already exists`);

    const group = await GroupModel.create({
      ...payload,
      code,
      createdBy: req.user?._id,
    });

    await auditService.record({
      req,
      action: "GROUP_CREATED",
      module: "trips",
      entityType: "Group",
      entityId: group._id.toString(),
      newValues: group.toObject(),
    });

    return group;
  }
}

export const tripService = new TripService();
