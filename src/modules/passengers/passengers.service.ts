import { Request } from "express";
import { PassengerModel } from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import { BadRequestException, ConflictException, NotFoundException } from "../../common/exception";
import { auditService } from "../../common/service";
import { assertBranchAccess, resolveScopedBranchFilter } from "../../middleware";
import { PASSPORT_MIN_VALIDITY_MONTHS, PASSPORT_POLICY_MODE } from "../../config";

const EGYPT_GOVERNORATE_CODES: Record<string, string> = {
  "01": "Cairo",
  "02": "Alexandria",
  "03": "Port Said",
  "04": "Suez",
  "11": "Damietta",
  "12": "Dakahlia",
  "13": "Sharqia",
  "14": "Qalyubia",
  "15": "Kafr El Sheikh",
  "16": "Gharbia",
  "17": "Monufia",
  "18": "Beheira",
  "19": "Ismailia",
  "21": "Giza",
  "22": "Beni Suef",
  "23": "Fayoum",
  "24": "Minya",
  "25": "Asyut",
  "26": "Sohag",
  "27": "Qena",
  "28": "Aswan",
  "29": "Luxor",
  "31": "Red Sea",
  "32": "New Valley",
  "33": "Matrouh",
  "34": "North Sinai",
  "35": "South Sinai",
  "88": "Born Abroad",
};

export interface IParsedEgyptianNationalId {
  nationalId: string;
  dateOfBirth: Date;
  dateOfBirthIso: string;
  gender: "MALE" | "FEMALE";
  governorateCode: string;
  governorateName: string;
}

/**
 * Parses and validates a 14-digit Egyptian National ID.
 */
export function parseEgyptianNationalId(nationalId: string): IParsedEgyptianNationalId {
  const cleaned = (nationalId || "").trim();
  if (!/^[23]\d{13}$/.test(cleaned)) {
    throw new BadRequestException("Invalid Egyptian National ID format: must be 14 digits starting with 2 or 3");
  }

  const centuryDigit = cleaned.charAt(0);
  const yearPart = parseInt(cleaned.slice(1, 3), 10);
  const monthPart = parseInt(cleaned.slice(3, 5), 10);
  const dayPart = parseInt(cleaned.slice(5, 7), 10);
  const govCode = cleaned.slice(7, 9);
  const genderDigit = parseInt(cleaned.charAt(12), 10);

  const fullYear = (centuryDigit === "2" ? 1900 : 2000) + yearPart;
  const dob = new Date(Date.UTC(fullYear, monthPart - 1, dayPart));

  if (
    dob.getUTCFullYear() !== fullYear ||
    dob.getUTCMonth() !== monthPart - 1 ||
    dob.getUTCDate() !== dayPart ||
    dob.getTime() > Date.now()
  ) {
    throw new BadRequestException("Invalid date of birth encoded in Egyptian National ID");
  }

  const governorateName = EGYPT_GOVERNORATE_CODES[govCode];
  if (!governorateName) {
    throw new BadRequestException(`Invalid governorate code (${govCode}) in Egyptian National ID`);
  }

  const gender: "MALE" | "FEMALE" = genderDigit % 2 === 1 ? "MALE" : "FEMALE";
  const dateOfBirthIso = dob.toISOString().slice(0, 10);

  return {
    nationalId: cleaned,
    dateOfBirth: dob,
    dateOfBirthIso,
    gender,
    governorateCode: govCode,
    governorateName,
  };
}

/**
 * Classifies passenger age on the travel departure date.
 */
export function classifyPassengerAgeOnTravelDate(
  dateOfBirth: Date,
  travelDepartureDate: Date = new Date(),
): { ageYears: number; ageClassification: "INFANT" | "CHILD" | "ADULT" } {
  const dob = new Date(dateOfBirth);
  const ref = new Date(travelDepartureDate);
  let age = ref.getUTCFullYear() - dob.getUTCFullYear();
  const m = ref.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  const ageYears = Math.max(0, age);
  const ageClassification = ageYears < 2 ? "INFANT" : ageYears < 12 ? "CHILD" : "ADULT";
  return { ageYears, ageClassification };
}

/**
 * Validates passport expiration date against travel departure date and configurable 6-month policy.
 */
export function evaluatePassportValidity(
  passportExpirationDate: Date,
  travelDepartureDate: Date,
  minMonths: number = PASSPORT_MIN_VALIDITY_MONTHS,
  policyMode: "REJECT" | "WARN" = PASSPORT_POLICY_MODE,
): {
  isValid: boolean;
  isExpiredAtTravel: boolean;
  monthsRemaining: number;
  warning?: string | undefined;
} {
  const exp = new Date(passportExpirationDate);
  const dep = new Date(travelDepartureDate);

  if (exp.getTime() <= dep.getTime()) {
    throw new BadRequestException("Passport is expired on or before the travel departure date");
  }

  const minExpiryDate = new Date(dep);
  minExpiryDate.setUTCMonth(minExpiryDate.getUTCMonth() + minMonths);

  const diffDays = (exp.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24);
  const monthsRemaining = Number((diffDays / 30.4375).toFixed(2));

  if (exp.getTime() < minExpiryDate.getTime()) {
    const message = `Passport validity (${monthsRemaining} months from departure) is below the required ${minMonths} months`;
    if (policyMode === "REJECT") {
      throw new BadRequestException(message);
    }
    return {
      isValid: true,
      isExpiredAtTravel: false,
      monthsRemaining,
      warning: message,
    };
  }

  return {
    isValid: true,
    isExpiredAtTravel: false,
    monthsRemaining,
  };
}

/**
 * Computes ICAO 9303 MRZ check digit (weights 7, 3, 1 modulo 10).
 */
export function computeMrzCheckDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i).toUpperCase();
    let val = 0;
    if (ch >= "0" && ch <= "9") {
      val = ch.charCodeAt(0) - 48;
    } else if (ch >= "A" && ch <= "Z") {
      val = ch.charCodeAt(0) - 55;
    } else if (ch === "<") {
      val = 0;
    }
    sum += val * weights[i % 3]!;
  }
  return sum % 10;
}

export class PassengerRepository extends DatabaseRepository<any> {
  constructor() {
    super(PassengerModel);
  }
}

export class PassengerService {
  private repo = new PassengerRepository();

  async createPassenger(payload: any, req: Request) {
    const branchId = assertBranchAccess(req.branchContext, payload.branchId);
    const parsedId = parseEgyptianNationalId(payload.nationalId);

    const cleanPassport = payload.passportNumber ? String(payload.passportNumber).toUpperCase().trim() : undefined;
    const duplicateOrConditions: Record<string, any>[] = [{ nationalId: parsedId.nationalId }];
    if (cleanPassport) {
      duplicateOrConditions.push({ passportNumber: cleanPassport });
    }

    const existing = await PassengerModel.findOne({
      $or: duplicateOrConditions,
    });
    if (existing) {
      throw new ConflictException("Passenger with this National ID or Passport Number already exists");
    }

    let issueDate: Date | undefined;
    let expDate: Date | undefined;
    if (payload.passportExpirationDate && payload.passportIssueDate) {
      expDate = new Date(payload.passportExpirationDate);
      issueDate = new Date(payload.passportIssueDate);
      if (expDate <= issueDate) {
        throw new BadRequestException("Passport expiration date must be after issue date");
      }
    } else if (payload.passportExpirationDate) {
      expDate = new Date(payload.passportExpirationDate);
    }

    const passenger = await PassengerModel.create({
      ...payload,
      branchId,
      nationalId: parsedId.nationalId,
      dateOfBirth: parsedId.dateOfBirth,
      gender: payload.gender || parsedId.gender,
      governorate: payload.governorate || parsedId.governorateName,
      ...(cleanPassport ? { passportNumber: cleanPassport } : {}),
      ...(issueDate ? { passportIssueDate: issueDate } : {}),
      ...(expDate ? { passportExpirationDate: expDate } : {}),
      ocrStatus: payload.ocrRawDraft ? "VERIFIED" : "MANUAL",
      createdBy: req.user?._id,
    });

    await auditService.record({
      req,
      action: "PASSENGER_CREATED",
      module: "passengers",
      entityType: "Passenger",
      entityId: passenger._id.toString(),
      branchId,
      newValues: passenger.toObject(),
    });

    return passenger;
  }

  async updatePassenger(id: string, payload: any, req: Request) {
    const filter: Record<string, any> = { _id: id };
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));

    const passenger = await PassengerModel.findOne(filter);
    if (!passenger) throw new NotFoundException("Passenger not found in your authorized branch scope");
    const prev = passenger.toObject();

    if (payload.nationalId && payload.nationalId !== passenger.nationalId) {
      const parsedId = parseEgyptianNationalId(payload.nationalId);
      passenger.nationalId = parsedId.nationalId;
      passenger.dateOfBirth = parsedId.dateOfBirth;
    }

    Object.assign(passenger, payload, { updatedBy: req.user?._id });
    await passenger.save();

    await auditService.record({
      req,
      action: "PASSENGER_UPDATED",
      module: "passengers",
      entityType: "Passenger",
      entityId: passenger._id.toString(),
      branchId: passenger.branchId,
      previousValues: prev,
      newValues: passenger.toObject(),
    });

    return passenger;
  }
}

export const passengerService = new PassengerService();
