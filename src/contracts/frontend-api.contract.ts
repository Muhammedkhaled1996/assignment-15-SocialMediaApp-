/**
 * ============================================================================
 * TROZIANA ENTERPRISE TRAVEL ERP — STANDALONE FRONTEND API CONTRACT (Next.js)
 * ============================================================================
 * Copy this standalone TypeScript file directly into the independent Next.js
 * frontend repository (e.g. `src/types/api-contract.ts`).
 * It contains zero backend imports and defines all Request/Response DTOs,
 * Pagination, Branch Context, Numeric User Roles (`roleNumber` 1..8), and Error Codes.
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "AUTHENTICATION_ERROR"
  | "TOKEN_EXPIRED"
  | "INVALID_TOKEN"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT_ERROR"
  | "DUPLICATE_KEY_ERROR"
  | "TRANSACTION_CONFLICT"
  | "INSUFFICIENT_INVENTORY"
  | "INSUFFICIENT_BALANCE"
  | "ACCOUNTING_INTEGRITY_ERROR"
  | "INVALID_STATE_TRANSITION"
  | "RATE_LIMIT_EXCEEDED"
  | "INTERNAL_SERVER_ERROR";

export enum UserRole {
  SUPER_ADMIN = 1,
  ADMIN = 2,
  BRANCH_MANAGER = 3,
  ACCOUNTANT = 4,
  SALES = 5,
  PROCUREMENT = 6,
  OPERATIONS = 7,
  EMPLOYEE = 8,
}

export type UserRoleName =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "ACCOUNTANT"
  | "SALES"
  | "PROCUREMENT"
  | "OPERATIONS"
  | "EMPLOYEE";

export interface ApiSuccessResponse<T, M = PaginationMeta> {
  success: true;
  message: string;
  status: number;
  data: T;
  meta: M;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error_message: string;
  code: ApiErrorCode;
  status: number;
  errors: Array<{ path?: (string | number)[]; message?: string; fields?: Record<string, unknown> }>;
}

export interface PaginationMeta {
  totalDocs?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
}

export interface PaginatedResult<T> {
  totalDocs: number;
  pagination: Required<Omit<PaginationMeta, "totalDocs">>;
  docs: T[];
}

export interface BranchScopeContextDto {
  isCentralAdmin: boolean;
  allowedBranchIds: string[];
  activeBranchId?: string;
  companyId?: string;
}

export interface UserDto {
  _id: string;
  name: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  phone?: string;
  roleNumber: UserRole;
  roleName: UserRoleName;
  branchId?: string | null;
  primaryBranchId?: string | null;
  assignedBranchIds?: string[];
  isActive: boolean;
  accountStatus: "ACTIVE" | "SUSPENDED" | "PENDING_ACTIVATION" | "ARCHIVED";
  canAccessAllBranches?: boolean;
}

export interface LoginResponseDto {
  access_token: string;
  refresh_token: string;
  user: UserDto;
  roleNumber: UserRole;
  roleName: UserRoleName;
  branchContext: BranchScopeContextDto;
}

export type PassengerCategoryDto = "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD" | "CHILD" | "INFANT";

export type TripCategoryDto = "DOMESTIC" | "RELIGIOUS" | "OUTBOUND";

export type TripTransportTypeDto = "FLIGHT" | "BUS" | "CRUISE" | "TRAIN" | "NONE";

export interface CompanyProfileDto {
  _id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  website?: string;
  supportedTourismTypes?: TripCategoryDto[];
  taxNumber?: string;
  commercialRegister?: string;
  tourismLicenseNumber?: string;
  baseCurrency: string;
  phone?: string;
  email?: string;
  address?: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface TripItineraryDayDto {
  dayNumber: number;
  titleAr: string;
  titleEn?: string;
  descriptionAr: string;
  descriptionEn?: string;
  meals?: string[];
  activities?: string[];
}

export type BookingStateDto =
  | "DRAFT"
  | "ON_HOLD"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export interface CreateBookingRequestDto {
  idempotencyKey?: string;
  tripId: string;
  groupId?: string | null;
  passengerId: string;
  branchId?: string;
  pricingVersionId?: string;
  roomType: "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD";
  passengerCategory?: PassengerCategoryDto;
  discountAmount?: number;
  status?: "DRAFT" | "ON_HOLD";
  holdMinutes?: number;
  mahramPassengerId?: string | null;
  familyGroupCode?: string;
  notes?: string;
}

export interface CreateReceiptRequestDto {
  idempotencyKey?: string;
  bookingId?: string;
  wholesaleContractId?: string;
  branchId?: string;
  cashboxId: string;
  amount: number;
  exchangeRateToEgp?: number;
  paymentMethod?: "CASH" | "BANK_TRANSFER" | "POS_CARD" | "CHEQUE";
  referenceCode?: string;
  notes?: string;
}
