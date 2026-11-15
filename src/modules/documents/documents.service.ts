import { Request } from "express";
import {
  BookingModel,
  BranchModel,
  CompanyModel,
  ReceiptModel,
  TripModel,
} from "../../DB/module";
import { NotFoundException } from "../../common/exception";
import { sequenceService } from "../../common/service";
import { resolveScopedBranchFilter } from "../../middleware";

export class DocumentService {
  /**
   * 1. Flyer Generator Data Endpoint
   */
  async getFlyerData(tripId: string, branchId?: string) {
    const [trip, company] = await Promise.all([
      TripModel.findById(tripId)
        .populate("approvedPricingVersionId")
        .populate({
          path: "hotelAllocations.hotelContractId",
          populate: { path: "hotelId", select: "nameAr nameEn city country stars distanceToHaramMeters address" },
        })
        .lean(),
      CompanyModel.findOne().lean(),
    ]);

    if (!trip) throw new NotFoundException("Trip not found");

    const branch = branchId
      ? await BranchModel.findById(branchId).lean()
      : await BranchModel.findOne({ isHeadquarters: true }).lean();

    const pricing = trip.approvedPricingVersionId as any;

    const defaultServices =
      trip.tripCategory === "DOMESTIC"
        ? ["الإقامة الفندقية الشاملة", "الانتقالات بأحدث الأتوبيسات السياحية المكيفه", "برنامج المزارات والرحلات الترفيهية", "مشرف سياحي مرافق طوال الرحلة"]
        : trip.tripCategory === "OUTBOUND"
          ? ["تذاكر الطيران الدولي ذهاب وعودة", "الإقامة الفندقية بالافطار", "الانتقالات من وإلى المطار", "برنامج الجولات السياحية اليومي", "مشرف سياحي مرافق"]
          : ["تأشيرة العمرة والباركود", "تذاكر الطيران ذهاب وعودة", "الإقامة بفنادق مكة والمدينة", "الانتقالات الداخلية بأحدث الأتوبيسات", "مشرف مرافق ذو خبرة"];

    const defaultDocs =
      trip.tripCategory === "DOMESTIC"
        ? ["أصل بطاقة الرقم القومي سارية", "شهادات الميلاد للأطفال", "قسيمة الزواج للغرف المزدوجة"]
        : ["جواز سفر صالح لمدة 6 أشهر على الأقل من تاريخ السفر", "عدد 2 صورة شخصية خلفية بيضاء", "بطاقة الرقم القومي سارية"];

    return {
      companyDetails: company
        ? {
            nameAr: company.nameAr,
            nameEn: company.nameEn,
            code: company.code,
            logoUrl: company.logoUrl || null,
            primaryColor: company.primaryColor || "#0F172A",
            secondaryColor: company.secondaryColor || "#D97706",
            tourismLicenseNumber: company.tourismLicenseNumber || null,
            phone: company.phone || null,
            email: company.email || null,
            address: company.address || null,
            website: company.website || null,
          }
        : null,
      trip: {
        code: trip.code,
        nameAr: trip.nameAr,
        nameEn: trip.nameEn,
        tripCategory: trip.tripCategory || "RELIGIOUS",
        transportType: trip.transportType || "FLIGHT",
        season: trip.season,
        destination: trip.destination,
        coverImage: trip.coverImage || null,
        galleryImages: trip.galleryImages || [],
        itinerary: trip.itinerary || [],
        departureDate: trip.departureDate,
        returnDate: trip.returnDate,
      },
      hotels: (trip.hotelAllocations || []).map((alloc: any) => ({
        city: alloc.city,
        hotel: alloc.hotelContractId?.hotelId || null,
        checkIn: alloc.hotelContractId?.checkIn,
        checkOut: alloc.hotelContractId?.checkOut,
        nights: alloc.hotelContractId?.nights,
      })),
      prices: pricing
        ? {
            exchangeRateSarToEgp: pricing.exchangeRateSarToEgp,
            SINGLE: pricing.categories?.SINGLE?.sellingPriceEgp,
            DOUBLE: pricing.categories?.DOUBLE?.sellingPriceEgp,
            TRIPLE: pricing.categories?.TRIPLE?.sellingPriceEgp,
            QUAD: pricing.categories?.QUAD?.sellingPriceEgp,
            CHILD: pricing.categories?.CHILD?.sellingPriceEgp,
            INFANT: pricing.categories?.INFANT?.sellingPriceEgp,
          }
        : null,
      includedServices: trip.includedServices?.length ? trip.includedServices : defaultServices,
      requiredDocuments: trip.requiredDocuments?.length ? trip.requiredDocuments : defaultDocs,
      branchDetails: branch
        ? {
            code: branch.code,
            nameAr: branch.nameAr,
            nameEn: branch.nameEn,
            governorate: branch.governorate,
            address: branch.address,
            phone: branch.phone,
            email: branch.email,
          }
        : null,
    };
  }

  /**
   * 2. Official Arabic Passenger Manifest Data
   */
  async getPassengerManifest(tripId: string, req: Request) {
    const trip = await TripModel.findById(tripId).lean();
    if (!trip) throw new NotFoundException("Trip not found");

    const filter: Record<string, any> = {
      tripId: trip._id,
      status: { $in: ["CONFIRMED", "COMPLETED"] },
    };
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, req.query.branchId as string, "branchId"));
    if (req.query.groupId) filter.groupId = req.query.groupId;

    const bookings = await BookingModel.find(filter)
      .populate("passengerId")
      .populate("groupId", "code nameAr nameEn supervisorName")
      .populate("mahramPassengerId", "arabicName englishName passportNumber")
      .populate("branchId", "code nameAr")
      .sort({ familyGroupCode: 1, createdAt: 1 })
      .lean();

    const manifestReference = await sequenceService.nextReference({
      documentType: "MANIFEST",
      prefix: "MNF",
    });

    const rows = bookings.map((b: any, index: number) => {
      const p = b.passengerId || {};
      const m = b.mahramPassengerId || {};
      const g = b.groupId || {};
      return {
        serial: index + 1,
        bookingNumber: b.bookingNumber,
        groupCode: g.code || trip.code,
        arabicName: p.arabicName,
        englishName: p.englishName,
        nationalId: p.nationalId,
        passportNumber: p.passportNumber,
        passportIssueDate: p.passportIssueDate,
        passportExpirationDate: p.passportExpirationDate,
        occupation: p.occupation || "—",
        governorate: p.governorate,
        gender: p.gender,
        mahramArabicName: m.arabicName || "—",
        mahramPassportNumber: m.passportNumber || "—",
        mahramRelationship: p.mahramRelationship || "—",
        roomType: b.roomType,
        branchNameAr: b.branchId?.nameAr || "—",
      };
    });

    return {
      manifestReference,
      presentationLanguage: "ar",
      disclaimer: "بيان ركاب تشغيلي داخلي لشركة تروزيانا للسياحة",
      trip: {
        code: trip.code,
        nameAr: trip.nameAr,
        departureDate: trip.departureDate,
        returnDate: trip.returnDate,
      },
      totalPassengers: rows.length,
      passengers: rows,
    };
  }

  /**
   * 3. Rooming List Generator (Printable Hotel Check-In Sheet)
   * Groups passengers into rooms according to their contracted roomType (DOUBLE=2, TRIPLE=3, QUAD=4)
   * and familyGroupCode, leaving `roomNumber: ""` blank so room numbers can be written by hand at the hotel after arrival.
   */
  async getRoomingList(tripId: string, cityParam: string | undefined, req: Request) {
    const trip = await TripModel.findById(tripId)
      .populate({
        path: "hotelAllocations.hotelContractId",
        populate: { path: "hotelId", select: "nameAr nameEn city country stars" },
      })
      .lean();

    if (!trip) throw new NotFoundException("Trip not found");

    const city = cityParam || (trip.hotelAllocations?.[0] as any)?.city || trip.destination || "MAKKAH";

    const filter: Record<string, any> = {
      tripId: trip._id,
      status: { $in: ["CONFIRMED", "COMPLETED", "PENDING_PAYMENT"] },
    };
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, req.query.branchId as string, "branchId"));

    const bookings = await BookingModel.find(filter)
      .populate("passengerId", "arabicName englishName gender nationalId passportNumber phone familyGroupCode")
      .populate("mahramPassengerId", "arabicName englishName")
      .sort({ roomType: 1, familyGroupCode: 1, createdAt: 1 })
      .lean();

    const capacityByType: Record<string, number> = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3, QUAD: 4 };
    const assignedRooms: Array<{
      roomIndex: number;
      roomNumber: string;
      roomType: "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD";
      maxCapacity: number;
      familyGroupCode: string | null;
      occupants: any[];
    }> = [];

    for (const b of bookings as any[]) {
      const p = b.passengerId || {};
      const roomType: "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD" = b.roomType || "QUAD";
      const maxCap = capacityByType[roomType] || 4;
      const familyCode = b.familyGroupCode || p.familyGroupCode || null;

      const occupantItem = {
        bookingId: b._id,
        bookingNumber: b.bookingNumber,
        passengerId: p._id,
        arabicName: p.arabicName,
        englishName: p.englishName,
        gender: p.gender,
        nationalId: p.nationalId,
        passportNumber: p.passportNumber || "—",
        familyGroupCode: familyCode,
        mahramName: b.mahramPassengerId?.arabicName || null,
      };

      // Find an open room of the same roomType and matching familyGroupCode (or general pool if no familyGroupCode)
      let targetRoom = assignedRooms.find(
        (r) =>
          r.roomType === roomType &&
          r.familyGroupCode === familyCode &&
          r.occupants.length < r.maxCapacity,
      );

      if (!targetRoom) {
        targetRoom = {
          roomIndex: assignedRooms.length + 1,
          roomNumber: "", // Left blank intentionally for manual handwriting at hotel check-in after travel
          roomType,
          maxCapacity: maxCap,
          familyGroupCode: familyCode,
          occupants: [],
        };
        assignedRooms.push(targetRoom);
      }

      targetRoom.occupants.push(occupantItem);
    }

    const hotelAlloc = (trip.hotelAllocations || []).find((a: any) => a.city === city) as any;

    return {
      tripCode: trip.code,
      city,
      hotel: hotelAlloc?.hotelContractId?.hotelId || null,
      checkIn: hotelAlloc?.hotelContractId?.checkIn || trip.departureDate,
      checkOut: hotelAlloc?.hotelContractId?.checkOut || trip.returnDate,
      assignedRooms,
      unassignedPassengers: [],
    };
  }

  /**
   * 4. Printable Receipt Document Data
   */
  async getReceiptPrintData(receiptId: string, req: Request) {
    const filter: Record<string, any> = { _id: receiptId };
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));

    const [receipt, company] = await Promise.all([
      ReceiptModel.findOne(filter)
        .populate("bookingId")
        .populate("passengerId", "arabicName englishName nationalId passportNumber phone")
        .populate("tripId", "code nameAr nameEn tripCategory destination departureDate")
        .populate("branchId", "code nameAr nameEn address phone")
        .populate("cashboxId", "code nameAr nameEn")
        .populate("createdBy", "firstName lastName email")
        .lean(),
      CompanyModel.findOne().lean(),
    ]);

    if (!receipt) throw new NotFoundException("Receipt not found");
    return {
      ...receipt,
      companyDetails: company
        ? {
            nameAr: company.nameAr,
            nameEn: company.nameEn,
            logoUrl: company.logoUrl || null,
            tourismLicenseNumber: company.tourismLicenseNumber || null,
            taxNumber: company.taxNumber || null,
            phone: company.phone || null,
            address: company.address || null,
          }
        : null,
    };
  }
}

export const documentService = new DocumentService();
