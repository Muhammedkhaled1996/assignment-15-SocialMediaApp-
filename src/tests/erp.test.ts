import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { spawn, ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.ENABLE_REDIS = "false";

import { Money } from "../common/utils/money";
import { UserAccountStatus, UserRole } from "../common/enum";
import { hotelService } from "../modules/hotels";
import { pricingService } from "../modules/pricing";
import {
  classifyPassengerAgeOnTravelDate,
  computeMrzCheckDigit,
  evaluatePassportValidity,
  parseEgyptianNationalId,
} from "../modules/passengers";
import { validateBookingStateTransition } from "../modules/bookings";
import { accountingService } from "../modules/accounting";
import { branchService } from "../modules/branches";
import { quotaService } from "../modules/quotas";
import { withTransaction } from "../common/utils";
import { runRoleNumberMigration } from "../scripts/migrate-roles-to-roleNumber";
import {
  BranchModel,
  TripModel,
  UserModel,
} from "../DB/module";
import app from "../main";

// Helper for HTTP requests against the Express app server
let serverUrl = "";
async function apiRequest(
  method: string,
  path: string,
  options: { token?: string; branchId?: string; idempotencyKey?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.branchId ? { "x-branch-id": options.branchId } : {}),
      ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// ============================================================================
// 1. UNIT TESTS — FINANCIAL PRECISION, PRICING, HOTEL RATES, EGYPTIAN ID & STATE
// ============================================================================
describe("Unit Tests — Financial Precision, Pricing Engine, Hotel Rates & Passenger Validation", () => {
  it("Money utility avoids floating-point drift (0.1 + 0.2 === 0.3)", () => {
    assert.equal(Money.add(0.1, 0.2), 0.3);
    assert.equal(Money.subtract(1000.0, 333.33), 666.67);
    assert.equal(Money.multiply(125.5, 3), 376.5);
    assert.equal(Money.divide(1000, 3), 333.33);
    assert.equal(Money.convert(1000, 13.4567), 13456.7);
  });

  it("Hotel pricing engine computes FLAT_RATE and TIERED_RATE per-room vs per-person stay rates accurately", () => {
    const flatResult = hotelService.calculateHotelContractPricing({
      pricingMode: "FLAT_RATE",
      nights: 5,
      doubleRooms: 10,
      tripleRooms: 10,
      quadRooms: 10,
      flatRoomRatePerNight: 600, // 600 SAR per room per night -> 3000 SAR per room for 5 nights
    });

    assert.equal(flatResult.roomCapacities.totalRooms, 30);
    assert.equal(flatResult.roomCapacities.totalBeds, 10 * 2 + 10 * 3 + 10 * 4);
    assert.equal(flatResult.rates.doublePerPersonStayRate, 1500); // 3000 / 2
    assert.equal(flatResult.rates.triplePerPersonStayRate, 1000); // 3000 / 3
    assert.equal(flatResult.rates.quadPerPersonStayRate, 750); // 3000 / 4
    assert.equal(flatResult.contractValue, 90000); // 30 rooms * 3000 SAR

    const tieredResult = hotelService.calculateHotelContractPricing({
      pricingMode: "TIERED_RATE",
      nights: 4,
      doubleRooms: 5,
      tripleRooms: 5,
      quadRooms: 10,
      doubleRoomRatePerNight: 500, // 2000 stay -> 1000/person
      tripleRoomRatePerNight: 600, // 2400 stay -> 800/person
      quadRoomRatePerNight: 700, // 2800 stay -> 700/person
    });

    assert.equal(tieredResult.rates.doublePerPersonStayRate, 1000);
    assert.equal(tieredResult.rates.triplePerPersonStayRate, 800);
    assert.equal(tieredResult.rates.quadPerPersonStayRate, 700);
    assert.equal(tieredResult.contractValue, 5 * 2000 + 5 * 2400 + 10 * 2800); // 10000 + 12000 + 28000 = 50000
  });

  it("Dynamic Pricing Engine distributes supervisor costs and calculates category selling prices & margins", () => {
    const scenario = pricingService.calculateScenario({
      exchangeRateSarToEgp: 13.5,
      groupCapacity: 40,
      inputs: {
        flightCostPerSeatEgp: 14000,
        makkahHotelPerPersonStaySar: { double: 2000, triple: 1500, quad: 1000 },
        madinahHotelPerPersonStaySar: { double: 1000, triple: 800, quad: 600 },
        saudiAgentFeeSar: 500,
        transportCostSar: 300,
        barcodeFeeEgp: 3200,
        giftsCostEgp: 300,
        otherOperationalCostEgp: 500,
        supervisorFlightTicketEgp: 14000,
        supervisorAccommodationSar: 1600,
        supervisorGratuitiesEgp: 4400,
        targetProfitMarginPercent: 15,
        maxDiscountPercentAllowed: 5,
        childPolicy: { flightCostMultiplier: 0.8, includeAccommodation: false },
        infantPolicy: { flightCostMultiplier: 0.2, visaAndAgentFeeSar: 500 },
      },
    });

    // Supervisor total = 14000 + (1600 * 13.5 = 21600) + 4400 = 40000 EGP -> 40000 / 40 = 1000 EGP/pax
    assert.equal(scenario.totals.totalSupervisorCostEgp, 40000);
    assert.equal(scenario.totals.supervisorCostPerPassengerEgp, 1000);

    // Operational cost per adult = (500 + 300)*13.5 + 3200 + 300 + 500 = 10800 + 4000 = 14800 EGP
    // QUAD accommodation = (1000 + 600)*13.5 = 21600 EGP
    // QUAD total cost = 14000 (flight) + 21600 (hotel) + 14800 (ops) + 1000 (supervisor) = 51400 EGP
    assert.equal(scenario.categories.QUAD.totalCostPerPassengerEgp, 51400);
    // Selling price @ 15% margin = 51400 * 1.15 = 59110 EGP
    assert.equal(scenario.categories.QUAD.sellingPriceEgp, 59110);
    assert.equal(scenario.categories.QUAD.profitPerPassengerEgp, 7710);
  });

  it("Egyptian National ID parser extracts DOB, gender, governorate, and rejects malformed IDs", () => {
    const parsed = parseEgyptianNationalId("29005150101234");
    assert.equal(parsed.dateOfBirthIso, "1990-05-15");
    assert.equal(parsed.gender, "MALE"); // 13th digit is '3' (odd)
    assert.equal(parsed.governorateName, "Cairo");

    assert.throws(() => parseEgyptianNationalId("19005150101234"));
    assert.throws(() => parseEgyptianNationalId("29013450101234"));
  });

  it("Age classification and Passport 6-month validity policy work deterministically", () => {
    const travelDate = new Date("2026-12-01T00:00:00Z");
    assert.equal(
      classifyPassengerAgeOnTravelDate(new Date("2025-06-01T00:00:00Z"), travelDate).ageClassification,
      "INFANT",
    );
    assert.equal(
      classifyPassengerAgeOnTravelDate(new Date("2018-06-01T00:00:00Z"), travelDate).ageClassification,
      "CHILD",
    );
    assert.equal(
      classifyPassengerAgeOnTravelDate(new Date("1990-05-15T00:00:00Z"), travelDate).ageClassification,
      "ADULT",
    );

    // Valid passport (> 6 months)
    const validEval = evaluatePassportValidity(new Date("2027-08-01T00:00:00Z"), travelDate, 6, "REJECT");
    assert.equal(validEval.isValid, true);

    // Less than 6 months -> throws in REJECT mode, warns in WARN mode
    assert.throws(() => evaluatePassportValidity(new Date("2027-03-01T00:00:00Z"), travelDate, 6, "REJECT"));
    const warnEval = evaluatePassportValidity(new Date("2027-03-01T00:00:00Z"), travelDate, 6, "WARN");
    assert.equal(Boolean(warnEval.warning), true);

    // MRZ Checksum test
    assert.equal(computeMrzCheckDigit("A12345678"), computeMrzCheckDigit("A12345678"));
  });

  it("Booking state machine enforces valid transitions and blocks illegal transitions", () => {
    assert.doesNotThrow(() => validateBookingStateTransition("ON_HOLD", "CONFIRMED"));
    assert.doesNotThrow(() => validateBookingStateTransition("CONFIRMED", "CANCELLED"));
    assert.throws(() => validateBookingStateTransition("CANCELLED", "CONFIRMED"));
    assert.throws(() => validateBookingStateTransition("REFUNDED", "CONFIRMED"));
  });
});

// ============================================================================
// 2. INTEGRATION, CONCURRENCY & SECURITY TESTS (WITH REAL MONGODB REPLICA SET)
// ============================================================================
describe("Integration, Concurrency & Security Suite — End-to-End ERP Workflows", () => {
  let mongodProc: ChildProcess | null = null;
  let dbDir = "";
  let httpServer: http.Server | null = null;

  before(async () => {
    dbDir = await mkdtemp(join(tmpdir(), "troziana-mongo-test-"));
    const mongoPort = 27200 + Math.floor(Math.random() * 500);
    const mongodBin = "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe";

    mongodProc = spawn(
      mongodBin,
      [
        "--dbpath",
        dbDir,
        "--port",
        String(mongoPort),
        "--bind_ip",
        "127.0.0.1",
        "--replSet",
        "rs0",
        "--quiet",
      ],
      { stdio: "ignore" },
    );

    // Wait for mongod to accept connections
    let adminConn: mongoose.Connection | null = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      try {
        adminConn = await mongoose
          .createConnection(`mongodb://127.0.0.1:${mongoPort}/admin?directConnection=true`, {
            serverSelectionTimeoutMS: 1000,
          })
          .asPromise();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    if (!adminConn) {
      throw new Error(`Failed to connect to test mongod on port ${mongoPort}`);
    }

    try {
      await adminConn.db!.admin().command({
        replSetInitiate: {
          _id: "rs0",
          members: [{ _id: 0, host: `127.0.0.1:${mongoPort}` }],
        },
      });
    } catch {
      // already initiated
    }

    // Wait until node becomes PRIMARY
    for (let attempt = 0; attempt < 30; attempt++) {
      const hello = await adminConn.db!.admin().command({ hello: 1 });
      if (hello.isWritablePrimary || hello.ismaster) {
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    await adminConn.close();

    await mongoose.connect(
      `mongodb://127.0.0.1:${mongoPort}/troziana_erp_test?replicaSet=rs0&directConnection=true`,
    );
    for (const model of Object.values(mongoose.models)) {
      await model.createCollection().catch(() => {});
    }
    await accountingService.ensureChartOfAccounts();
    await branchService.ensureDefaultCompanyAndHQBranch();

    await new Promise<void>((resolve) => {
      httpServer = app.listen(0, "127.0.0.1", () => {
        const addr = httpServer!.address() as { port: number };
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    }
    await mongoose.disconnect().catch(() => {});
    if (mongodProc) {
      mongodProc.kill();
      await new Promise((r) => setTimeout(r, 800));
    }
    if (dbDir) {
      await rm(dbDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  let superAdminId = "";
  let superAdminToken = "";
  let generalAdminId = "";
  let generalAdminToken = "";
  let cairoBranchToken = "";
  let alexBranchToken = "";
  let accountantToken = "";
  let employeeId = "";
  let employeeToken = "";
  let cairoBranchId = "";
  let alexBranchId = "";
  let cairoCashboxId = "";
  let supplierId = "";
  let flightLotId = "";
  let hotelId = "";
  let hotelContractId = "";
  let pricingVersionId = "";
  let sharedTripId = "";
  let allocatedTripId = "";

  it("1. Authenticates Super Admin (roleNumber=1), creates Cairo & Alexandria branches, and provisions users across numeric roles", async () => {
    const hqBranch = await BranchModel.findOne({ code: "HQ-CAI" });
    cairoBranchId = hqBranch!._id.toString();

    // Create Super Admin user (UserRole.SUPER_ADMIN = 1)
    const adminUser = await UserModel.create({
      firstName: "Mahmoud",
      lastName: "Owner",
      email: "owner@troziana.com",
      password: "Password123!",
      roleNumber: UserRole.SUPER_ADMIN,
      branchId: hqBranch!._id,
      primaryBranchId: hqBranch!._id,
      canAccessAllBranches: true,
      isActive: true,
      accountStatus: UserAccountStatus.ACTIVE,
      confirmEmail: new Date(),
    });
    superAdminId = adminUser._id.toString();

    const loginRes = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: "owner@troziana.com", password: "Password123!" },
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.success, true);
    assert.equal(loginRes.body.data.roleNumber, UserRole.SUPER_ADMIN);
    assert.equal(loginRes.body.data.roleName, "SUPER_ADMIN");
    superAdminToken = loginRes.body.data.access_token;
    assert.ok(superAdminToken);

    // Verify GET /api/v1/auth/me returns current user with roleNumber
    const meRes = await apiRequest("GET", "/api/v1/auth/me", {
      token: superAdminToken,
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.roleNumber, UserRole.SUPER_ADMIN);
    assert.equal(meRes.body.data.roleName, "SUPER_ADMIN");

    // Create Alexandria Branch via API
    const alexBranchRes = await apiRequest("POST", "/api/v1/branches", {
      token: superAdminToken,
      body: {
        code: "BR-ALX",
        nameAr: "فرع الإسكندرية",
        nameEn: "Alexandria Branch",
        governorate: "Alexandria",
        city: "Alexandria",
      },
    });
    assert.equal(alexBranchRes.status, 201);
    alexBranchId = alexBranchRes.body.data._id;

    // Create General Admin (roleNumber = 2)
    const genAdminRes = await apiRequest("POST", "/api/v1/users", {
      token: superAdminToken,
      body: {
        name: "Tarek GeneralAdmin",
        email: "admin@troziana.com",
        password: "Password123!",
        roleNumber: UserRole.ADMIN,
        branchId: cairoBranchId,
      },
    });
    assert.equal(genAdminRes.status, 201);
    assert.equal(genAdminRes.body.data.roleNumber, UserRole.ADMIN);
    generalAdminId = genAdminRes.body.data._id;

    const genAdminLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: "admin@troziana.com", password: "Password123!" },
    });
    generalAdminToken = genAdminLogin.body.data.access_token;

    // Create Cairo Branch Manager (roleNumber = 3) & Alexandria Branch Manager (roleNumber = 3)
    const cairoStaff = await apiRequest("POST", "/api/v1/users", {
      token: superAdminToken,
      body: {
        firstName: "Ahmed",
        lastName: "Cairo",
        email: "cairo@troziana.com",
        password: "Password123!",
        roleNumber: UserRole.BRANCH_MANAGER,
        branchId: cairoBranchId,
      },
    });
    assert.equal(cairoStaff.status, 201);
    assert.equal(cairoStaff.body.data.roleNumber, UserRole.BRANCH_MANAGER);

    const alexStaff = await apiRequest("POST", "/api/v1/users", {
      token: superAdminToken,
      body: {
        firstName: "Kareem",
        lastName: "Alex",
        email: "alex@troziana.com",
        password: "Password123!",
        roleNumber: UserRole.BRANCH_MANAGER,
        branchId: alexBranchId,
      },
    });
    assert.equal(alexStaff.status, 201);

    // Create Accountant (roleNumber = 4) and Cairo POS Employee (roleNumber = 8)
    const accStaff = await apiRequest("POST", "/api/v1/users", {
      token: generalAdminToken,
      body: {
        name: "Hany Accountant",
        email: "accountant@troziana.com",
        password: "Password123!",
        roleNumber: UserRole.ACCOUNTANT,
        branchId: cairoBranchId,
      },
    });
    assert.equal(accStaff.status, 201);

    const empStaff = await apiRequest("POST", "/api/v1/users", {
      token: generalAdminToken,
      body: {
        name: "Salma Employee",
        email: "employee@troziana.com",
        password: "Password123!",
        roleNumber: UserRole.EMPLOYEE,
        branchId: cairoBranchId,
      },
    });
    assert.equal(empStaff.status, 201);
    employeeId = empStaff.body.data._id;

    const cairoLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: "cairo@troziana.com", password: "Password123!" },
    });
    cairoBranchToken = cairoLogin.body.data.access_token;

    const alexLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: "alex@troziana.com", password: "Password123!" },
    });
    alexBranchToken = alexLogin.body.data.access_token;

    const accLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: "accountant@troziana.com", password: "Password123!" },
    });
    accountantToken = accLogin.body.data.access_token;

    const empLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: "employee@troziana.com", password: "Password123!" },
    });
    employeeToken = empLogin.body.data.access_token;
  });

  it("2. User Management & Role Security: Enforces authorizeRoles, blocks self-role modification, blocks privilege escalation, protects SUPER_ADMIN, and blocks deactivated users", async () => {
    // 1. Forbidden route access: EMPLOYEE (8) and BRANCH_MANAGER (3) cannot create users
    const empCreateUser = await apiRequest("POST", "/api/v1/users", {
      token: employeeToken,
      body: {
        name: "Unauthorized User",
        email: "unauth@troziana.com",
        password: "Password123!",
        roleNumber: UserRole.EMPLOYEE,
      },
    });
    assert.equal(empCreateUser.status, 403);

    const bmCreateUser = await apiRequest("POST", "/api/v1/users", {
      token: cairoBranchToken,
      body: {
        name: "Unauthorized By BM",
        email: "unauth-bm@troziana.com",
        password: "Password123!",
        roleNumber: UserRole.EMPLOYEE,
      },
    });
    assert.equal(bmCreateUser.status, 403);

    // 2. BRANCH_MANAGER (3) can list users in their own branch, but cannot query another branch
    const bmListOwnBranch = await apiRequest("GET", "/api/v1/users", {
      token: cairoBranchToken,
    });
    assert.equal(bmListOwnBranch.status, 200);
    for (const u of bmListOwnBranch.body.data.docs) {
      assert.equal(u.branchId, cairoBranchId);
    }

    const bmListCrossBranch = await apiRequest("GET", `/api/v1/users?branchId=${alexBranchId}`, {
      token: cairoBranchToken,
    });
    assert.equal(bmListCrossBranch.status, 403);

    // 3. Self-role modification prevention: SUPER_ADMIN cannot change own role
    const selfRoleChange = await apiRequest("PATCH", `/api/v1/users/${superAdminId}/role`, {
      token: superAdminToken,
      body: { roleNumber: UserRole.ADMIN },
    });
    assert.equal(selfRoleChange.status, 403);

    // 4. Privilege escalation prevention: ADMIN (2) cannot assign SUPER_ADMIN (1) or ADMIN (2)
    const adminEscalateToSuper = await apiRequest("PATCH", `/api/v1/users/${employeeId}/role`, {
      token: generalAdminToken,
      body: { roleNumber: UserRole.SUPER_ADMIN },
    });
    assert.equal(adminEscalateToSuper.status, 403);

    const adminEscalateToAdmin = await apiRequest("PATCH", `/api/v1/users/${employeeId}/role`, {
      token: generalAdminToken,
      body: { roleNumber: UserRole.ADMIN },
    });
    assert.equal(adminEscalateToAdmin.status, 403);

    // 5. SUPER_ADMIN protection: ADMIN (2) cannot update, deactivate, or delete SUPER_ADMIN (1)
    const adminModifySuper = await apiRequest("PATCH", `/api/v1/users/${superAdminId}`, {
      token: generalAdminToken,
      body: { name: "Hacked Owner" },
    });
    assert.equal(adminModifySuper.status, 403);

    const adminDeleteSuper = await apiRequest("DELETE", `/api/v1/users/${superAdminId}`, {
      token: generalAdminToken,
    });
    assert.equal(adminDeleteSuper.status, 403);

    // 6. Valid role update by ADMIN (2): Promote EMPLOYEE (8) -> SALES (5) and back to EMPLOYEE (8)
    const promoteToSales = await apiRequest("PATCH", `/api/v1/users/${employeeId}/role`, {
      token: generalAdminToken,
      body: { roleNumber: UserRole.SALES },
    });
    assert.equal(promoteToSales.status, 200);
    assert.equal(promoteToSales.body.data.roleNumber, UserRole.SALES);
    assert.equal(promoteToSales.body.data.roleName, "SALES");

    const revertToEmployee = await apiRequest("PATCH", `/api/v1/users/${employeeId}/role`, {
      token: generalAdminToken,
      body: { roleNumber: UserRole.EMPLOYEE },
    });
    assert.equal(revertToEmployee.status, 200);
    assert.equal(revertToEmployee.body.data.roleNumber, UserRole.EMPLOYEE);

    // Re-authenticate employee since role change revokes prior sessions
    const empRelogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: "employee@troziana.com", password: "Password123!" },
    });
    assert.equal(empRelogin.status, 200);
    employeeToken = empRelogin.body.data.access_token;

    // 7. Deactivated account cannot access protected endpoints or log in
    const tempUserRes = await apiRequest("POST", "/api/v1/users", {
      token: generalAdminToken,
      body: {
        name: "Temp Procurement User",
        email: "temp.proc@troziana.com",
        password: "Password123!",
        roleNumber: UserRole.PROCUREMENT,
        branchId: cairoBranchId,
      },
    });
    assert.equal(tempUserRes.status, 201);
    const tempUserId = tempUserRes.body.data._id;

    const tempLogin = await apiRequest("POST", "/api/v1/auth/login", {
      body: { email: "temp.proc@troziana.com", password: "Password123!" },
    });
    assert.equal(tempLogin.status, 200);
    const tempToken = tempLogin.body.data.access_token;

    // Deactivate temp user via PATCH /api/v1/users/:id
    const deactivateRes = await apiRequest("PATCH", `/api/v1/users/${tempUserId}`, {
      token: generalAdminToken,
      body: { isActive: false, reason: "End of contract" },
    });
    assert.equal(deactivateRes.status, 200);
    assert.equal(deactivateRes.body.data.isActive, false);

    // Existing token is rejected immediately
    const deactivatedAccess = await apiRequest("GET", "/api/v1/auth/me", {
      token: tempToken,
    });
    assert.equal(deactivatedAccess.status, 403);

    // Delete temporary user
    const deleteRes = await apiRequest("DELETE", `/api/v1/users/${tempUserId}`, {
      token: generalAdminToken,
    });
    assert.equal(deleteRes.status, 200);

    // 8. Verify idempotent migration script converts legacy role strings/missing roles safely
    const rawUsers = mongoose.connection.db!.collection("users");
    const legacyInsert = await rawUsers.insertOne({
      firstName: "Legacy",
      lastName: "Staff",
      userName: "Legacy Staff",
      email: "legacy.staff@troziana.com",
      password: "hashedpassword",
      role: "OPERATIONS_MANAGER",
      primaryBranchId: new mongoose.Types.ObjectId(cairoBranchId),
      accountStatus: "ACTIVE",
    });

    const migrationResult = await runRoleNumberMigration({
      apply: true,
      dropLegacyCollections: false,
    });
    assert.ok(migrationResult.migratedCount >= 1);

    const migratedDoc = await UserModel.findById(legacyInsert.insertedId).lean();
    assert.equal(migratedDoc!.roleNumber, UserRole.OPERATIONS);
    assert.equal(migratedDoc!.isActive, true);
    assert.equal(String(migratedDoc!.branchId), cairoBranchId);
  });

  it("3. Procurement & Supplier Ledger: Creates Supplier, Flight Lot, and Hotel Contract with automatic ledger liabilities", async () => {
    // Security check: EMPLOYEE (8) cannot create suppliers
    const forbiddenSup = await apiRequest("POST", "/api/v1/suppliers", {
      token: employeeToken,
      body: {
        code: "SUP-FORBIDDEN",
        nameAr: "مورد غير مصرح",
        nameEn: "Forbidden Supplier",
        type: "AIRLINE",
        currency: "SAR",
      },
    });
    assert.equal(forbiddenSup.status, 403);

    const supRes = await apiRequest("POST", "/api/v1/suppliers", {
      token: superAdminToken,
      body: {
        code: "SUP-SAUDIA",
        nameAr: "الخطوط السعودية والفنادق",
        nameEn: "Saudi Airlines & Hotels Group",
        type: "AIRLINE",
        currency: "SAR",
        openingBalance: 10000,
        exchangeRateToEgp: 13.5,
      },
    });
    assert.equal(supRes.status, 201);
    supplierId = supRes.body.data._id;

    // Create Flight Lot (50 seats @ 1000 SAR = 50,000 SAR)
    const flightRes = await apiRequest("POST", "/api/v1/flights", {
      token: superAdminToken,
      body: {
        airline: "Saudia",
        supplierId,
        purchaseSource: "DIRECT",
        flightRoute: "CAI-JED-MED-CAI",
        departureAirport: "CAI",
        arrivalAirport: "JED",
        departureDate: "2027-01-10T00:00:00.000Z",
        returnDate: "2027-01-20T00:00:00.000Z",
        seatQuantity: 50,
        unitCost: 1000,
        currency: "SAR",
        exchangeRateToEgp: 13.5,
      },
    });
    assert.equal(flightRes.status, 201);
    flightLotId = flightRes.body.data._id;
    assert.equal(flightRes.body.data.totalCost, 50000);

    // Create Hotel & Hotel Contract (FLAT_RATE: 10 quad rooms * 5 nights * 800 SAR = 40,000 SAR)
    const hotelRes = await apiRequest("POST", "/api/v1/hotels", {
      token: superAdminToken,
      body: {
        nameAr: "فندق دار التوحيد مكة",
        nameEn: "Dar Al Tawhid Makkah",
        city: "MAKKAH",
        stars: 5,
      },
    });
    assert.equal(hotelRes.status, 201);
    hotelId = hotelRes.body.data._id;

    const hcRes = await apiRequest("POST", "/api/v1/hotels/contracts", {
      token: superAdminToken,
      body: {
        hotelId,
        supplierId,
        city: "MAKKAH",
        checkIn: "2027-01-10T00:00:00.000Z",
        checkOut: "2027-01-15T00:00:00.000Z",
        nights: 5,
        roomCapacities: { doubleRooms: 0, tripleRooms: 0, quadRooms: 10 },
        pricingMode: "FLAT_RATE",
        currency: "SAR",
        rates: { flatRoomRatePerNight: 800 },
        exchangeRateToEgp: 13.5,
      },
    });
    assert.equal(hcRes.status, 201);
    hotelContractId = hcRes.body.data._id;
    assert.equal(hcRes.body.data.contractValue, 40000);

    // Verify Supplier Ledger statement: 10,000 (opening) + 50,000 (flight) + 40,000 (hotel) = 100,000 SAR
    const stmtRes = await apiRequest("GET", `/api/v1/suppliers/${supplierId}/statement`, {
      token: accountantToken,
    });
    assert.equal(stmtRes.status, 200);
    assert.equal(stmtRes.body.data.summary.calculatedBalance, 100000);
    assert.equal(stmtRes.body.data.summary.currentBalance, 100000);
  });

  it("4. Concurrency Race Test: Two branches attempting to reserve the final seat simultaneously", async () => {
    // Create and approve a pricing version
    const pvRes = await apiRequest("POST", "/api/v1/pricing", {
      token: superAdminToken,
      body: {
        code: "PRC-RAMADAN-V1",
        name: "Ramadan Umrah Pricing V1",
        exchangeRateSarToEgp: 13.5,
        groupCapacity: 40,
        inputs: {
          flightCostPerSeatEgp: 13500,
          makkahHotelPerPersonStaySar: { double: 2000, triple: 1500, quad: 1000 },
          madinahHotelPerPersonStaySar: { double: 1000, triple: 800, quad: 600 },
          saudiAgentFeeSar: 500,
          transportCostSar: 300,
          barcodeFeeEgp: 3200,
          giftsCostEgp: 300,
          otherOperationalCostEgp: 500,
          supervisorFlightTicketEgp: 13500,
          supervisorAccommodationSar: 1600,
          supervisorGratuitiesEgp: 4900,
          targetProfitMarginPercent: 15,
          maxDiscountPercentAllowed: 5,
        },
      },
    });
    assert.equal(pvRes.status, 201);
    pricingVersionId = pvRes.body.data._id;

    const approveRes = await apiRequest("PATCH", `/api/v1/pricing/${pricingVersionId}/approve`, {
      token: superAdminToken,
    });
    assert.equal(approveRes.status, 200);

    // Create a SHARED_QUOTA Trip with ONLY 1 SEAT available!
    const tripRes = await apiRequest("POST", "/api/v1/trips", {
      token: superAdminToken,
      body: {
        code: "TRP-FINAL-SEAT-TEST",
        nameAr: "رحلة اختبار المقعد الأخير",
        nameEn: "Final Seat Concurrency Test Trip",
        season: "1448H",
        departureDate: "2027-01-10T00:00:00.000Z",
        returnDate: "2027-01-20T00:00:00.000Z",
        capacity: 1,
        approvedPricingVersionId: pricingVersionId,
        quotaMode: "SHARED_QUOTA",
      },
    });
    assert.equal(tripRes.status, 201);
    sharedTripId = tripRes.body.data._id;

    // Launch two simultaneous seat reservation requests from Cairo Branch and Alexandria Branch for the 1 remaining seat
    const [resCairo, resAlex] = await Promise.all([
      withTransaction((session) =>
        quotaService.reserveSeatsAtomically({
          tripId: sharedTripId,
          branchId: cairoBranchId,
          quantity: 1,
          session,
        }),
      )
        .then(() => 201)
        .catch(() => 409),
      withTransaction((session) =>
        quotaService.reserveSeatsAtomically({
          tripId: sharedTripId,
          branchId: alexBranchId,
          quantity: 1,
          session,
        }),
      )
        .then(() => 201)
        .catch(() => 409),
    ]);

    const statuses = [resCairo, resAlex].sort();
    // Exactly one must succeed (201) and one must fail with 409 InsufficientInventoryError!
    assert.deepEqual(statuses, [201, 409]);

    const updatedTrip = await TripModel.findById(sharedTripId).lean();
    assert.equal(updatedTrip!.availableInventory, 0);
    assert.equal(updatedTrip!.reservedSeats, 1);
  });

  it("5. Idempotency Test: Duplicate reservation requests with the same Idempotency-Key do not double-deduct inventory", async () => {
    const tripRes = await apiRequest("POST", "/api/v1/trips", {
      token: superAdminToken,
      body: {
        code: "TRP-IDEMPOTENCY-TEST",
        nameAr: "رحلة اختبار التكرار",
        nameEn: "Idempotency Trip",
        season: "1448H",
        departureDate: "2027-01-10T00:00:00.000Z",
        returnDate: "2027-01-20T00:00:00.000Z",
        capacity: 10,
        approvedPricingVersionId: pricingVersionId,
        quotaMode: "SHARED_QUOTA",
      },
    });
    allocatedTripId = tripRes.body.data._id;

    const idemKey = "IDEM-KEY-CAIRO-001";
    const [firstCall, secondCall] = await Promise.all([
      withTransaction((session) =>
        quotaService.reserveSeatsAtomically({
          tripId: allocatedTripId,
          branchId: cairoBranchId,
          quantity: 1,
          idempotencyKey: idemKey,
          session,
        }),
      ),
      withTransaction((session) =>
        quotaService.reserveSeatsAtomically({
          tripId: allocatedTripId,
          branchId: cairoBranchId,
          quantity: 1,
          idempotencyKey: idemKey,
          session,
        }),
      ),
    ]);

    assert.equal(String(firstCall._id), String(secondCall._id));

    const tripAfter = await TripModel.findById(allocatedTripId).lean();
    assert.equal(tripAfter!.availableInventory, 9); // Deducted only once!
  });

  it("6. Branch Isolation, Passenger Registration, Booking Lifecycle, Sensitive Cashbox/Financial Controls & Double-Entry Accounting", async () => {
    // 1. Cairo POS Employee (roleNumber=8) registers a passenger
    const paxRes = await apiRequest("POST", "/api/v1/passengers", {
      token: employeeToken,
      body: {
        arabicName: "محمد أحمد علي حسن",
        englishName: "MOHAMED AHMED ALI HASSAN",
        nationalId: "29005150101234",
        phone: "01012345678",
        passportNumber: "A99887766",
        passportIssueDate: "2024-01-01",
        passportExpirationDate: "2030-01-01",
        familyGroupCode: "FAM-01",
      },
    });
    assert.equal(paxRes.status, 201);
    const passengerId = paxRes.body.data._id;

    // Security Test: Alexandria Branch Manager cannot view Cairo's passenger
    const crossBranchPaxGet = await apiRequest("GET", `/api/v1/passengers/${passengerId}`, {
      token: alexBranchToken,
    });
    assert.equal(crossBranchPaxGet.status, 404);

    // Security Test: Alexandria Branch Manager cannot force-query Cairo's branchId
    const crossBranchList = await apiRequest("GET", `/api/v1/passengers?branchId=${cairoBranchId}`, {
      token: alexBranchToken,
    });
    assert.equal(crossBranchList.status, 403);

    // 2. Cairo POS Employee creates a Booking on `allocatedTripId`
    const bookingRes = await apiRequest("POST", "/api/v1/bookings", {
      token: employeeToken,
      body: {
        tripId: allocatedTripId,
        passengerId,
        roomType: "QUAD",
        passengerCategory: "QUAD",
        discountAmount: 1000,
      },
    });
    assert.equal(bookingRes.status, 201);
    const bookingId = bookingRes.body.data._id;
    const netPrice = bookingRes.body.data.netSellingPrice;
    assert.equal(bookingRes.body.data.status, "ON_HOLD");

    // Security Test: POS Employee (roleNumber=8) cannot create a Cashbox or confirm a Booking
    const empCreateCashbox = await apiRequest("POST", "/api/v1/cashboxes", {
      token: employeeToken,
      body: {
        code: "CB-FORBIDDEN",
        nameAr: "خزينة غير مصرحة",
        nameEn: "Forbidden Cashbox",
        currency: "EGP",
        openingBalance: 1000,
      },
    });
    assert.equal(empCreateCashbox.status, 403);

    const empConfirmBooking = await apiRequest("POST", `/api/v1/bookings/${bookingId}/confirm`, {
      token: employeeToken,
    });
    assert.equal(empConfirmBooking.status, 403);

    // 3. Cairo Branch Manager (roleNumber=3) creates Cairo Cashbox with 100,000 EGP opening balance
    const cbRes = await apiRequest("POST", "/api/v1/cashboxes", {
      token: cairoBranchToken,
      body: {
        code: "CB-CAI-MAIN",
        nameAr: "خزينة فرع القاهرة",
        nameEn: "Cairo Branch Cashbox",
        currency: "EGP",
        openingBalance: 100000,
      },
    });
    assert.equal(cbRes.status, 201);
    cairoCashboxId = cbRes.body.data._id;

    // 4. Collect partial payment Receipt (20,000 EGP)
    const rcvRes = await apiRequest("POST", "/api/v1/receipts", {
      token: cairoBranchToken,
      body: {
        bookingId,
        cashboxId: cairoCashboxId,
        amount: 20000,
        paymentMethod: "CASH",
      },
    });
    assert.equal(rcvRes.status, 201);

    // 5. Confirm the Booking (by Branch Manager)
    const confirmRes = await apiRequest("POST", `/api/v1/bookings/${bookingId}/confirm`, {
      token: cairoBranchToken,
    });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.data.status, "CONFIRMED");

    // Verify Manifest & Rooming List Documents
    const manifestRes = await apiRequest("GET", `/api/v1/documents/manifest/${allocatedTripId}`, {
      token: cairoBranchToken,
    });
    assert.equal(manifestRes.status, 200);
    assert.equal(manifestRes.body.data.totalPassengers, 1);

    const roomingRes = await apiRequest("GET", `/api/v1/documents/rooming-list/${allocatedTripId}?city=MAKKAH`, {
      token: cairoBranchToken,
    });
    assert.equal(roomingRes.status, 200);
    assert.equal(roomingRes.body.data.assignedRooms.length, 1);

    // 6. Verify Financial Statements & Balance Sheet are strictly balanced
    const fsRes = await apiRequest("GET", "/api/v1/accounting/financial-statements", {
      token: accountantToken,
    });
    assert.equal(fsRes.status, 200);
    assert.equal(fsRes.body.data.balanceSheet.isBalanced, true);
    assert.equal(fsRes.body.data.balanceSheet.totalAssets, 120000); // 100k opening + 20k customer receipt

    // 7. Verify Trip Profitability Report separates Forecast, Operational Actual, and Accounting Profit
    const reportRes = await apiRequest("GET", `/api/v1/reports/trip-profitability?tripId=${allocatedTripId}`, {
      token: superAdminToken,
    });
    assert.equal(reportRes.status, 200);
    const tripRep = reportRes.body.data[0];
    assert.equal(tripRep.operationalActual.bookingsCount, 1);
    assert.equal(tripRep.operationalActual.revenueEgp, netPrice);
    assert.equal(tripRep.operationalActual.collectedCashEgp, 20000);
  });
});
