"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const node_child_process_1 = require("node:child_process");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const mongoose_1 = __importDefault(require("mongoose"));
process.env.NODE_ENV = "test";
process.env.ENABLE_REDIS = "false";
const money_1 = require("../common/utils/money");
const enum_1 = require("../common/enum");
const hotels_1 = require("../modules/hotels");
const pricing_1 = require("../modules/pricing");
const passengers_1 = require("../modules/passengers");
const bookings_1 = require("../modules/bookings");
const accounting_1 = require("../modules/accounting");
const branches_1 = require("../modules/branches");
const quotas_1 = require("../modules/quotas");
const utils_1 = require("../common/utils");
const migrate_roles_to_roleNumber_1 = require("../scripts/migrate-roles-to-roleNumber");
const module_1 = require("../DB/module");
const main_1 = __importDefault(require("../main"));
let serverUrl = "";
async function apiRequest(method, path, options = {}) {
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
(0, node_test_1.describe)("Unit Tests — Financial Precision, Pricing Engine, Hotel Rates & Passenger Validation", () => {
    (0, node_test_1.it)("Money utility avoids floating-point drift (0.1 + 0.2 === 0.3)", () => {
        strict_1.default.equal(money_1.Money.add(0.1, 0.2), 0.3);
        strict_1.default.equal(money_1.Money.subtract(1000.0, 333.33), 666.67);
        strict_1.default.equal(money_1.Money.multiply(125.5, 3), 376.5);
        strict_1.default.equal(money_1.Money.divide(1000, 3), 333.33);
        strict_1.default.equal(money_1.Money.convert(1000, 13.4567), 13456.7);
    });
    (0, node_test_1.it)("Hotel pricing engine computes FLAT_RATE and TIERED_RATE per-room vs per-person stay rates accurately", () => {
        const flatResult = hotels_1.hotelService.calculateHotelContractPricing({
            pricingMode: "FLAT_RATE",
            nights: 5,
            doubleRooms: 10,
            tripleRooms: 10,
            quadRooms: 10,
            flatRoomRatePerNight: 600,
        });
        strict_1.default.equal(flatResult.roomCapacities.totalRooms, 30);
        strict_1.default.equal(flatResult.roomCapacities.totalBeds, 10 * 2 + 10 * 3 + 10 * 4);
        strict_1.default.equal(flatResult.rates.doublePerPersonStayRate, 1500);
        strict_1.default.equal(flatResult.rates.triplePerPersonStayRate, 1000);
        strict_1.default.equal(flatResult.rates.quadPerPersonStayRate, 750);
        strict_1.default.equal(flatResult.contractValue, 90000);
        const tieredResult = hotels_1.hotelService.calculateHotelContractPricing({
            pricingMode: "TIERED_RATE",
            nights: 4,
            doubleRooms: 5,
            tripleRooms: 5,
            quadRooms: 10,
            doubleRoomRatePerNight: 500,
            tripleRoomRatePerNight: 600,
            quadRoomRatePerNight: 700,
        });
        strict_1.default.equal(tieredResult.rates.doublePerPersonStayRate, 1000);
        strict_1.default.equal(tieredResult.rates.triplePerPersonStayRate, 800);
        strict_1.default.equal(tieredResult.rates.quadPerPersonStayRate, 700);
        strict_1.default.equal(tieredResult.contractValue, 5 * 2000 + 5 * 2400 + 10 * 2800);
    });
    (0, node_test_1.it)("Dynamic Pricing Engine distributes supervisor costs and calculates category selling prices & margins", () => {
        const scenario = pricing_1.pricingService.calculateScenario({
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
        strict_1.default.equal(scenario.totals.totalSupervisorCostEgp, 40000);
        strict_1.default.equal(scenario.totals.supervisorCostPerPassengerEgp, 1000);
        strict_1.default.equal(scenario.categories.QUAD.totalCostPerPassengerEgp, 51400);
        strict_1.default.equal(scenario.categories.QUAD.sellingPriceEgp, 59110);
        strict_1.default.equal(scenario.categories.QUAD.profitPerPassengerEgp, 7710);
    });
    (0, node_test_1.it)("Egyptian National ID parser extracts DOB, gender, governorate, and rejects malformed IDs", () => {
        const parsed = (0, passengers_1.parseEgyptianNationalId)("29005150101234");
        strict_1.default.equal(parsed.dateOfBirthIso, "1990-05-15");
        strict_1.default.equal(parsed.gender, "MALE");
        strict_1.default.equal(parsed.governorateName, "Cairo");
        strict_1.default.throws(() => (0, passengers_1.parseEgyptianNationalId)("19005150101234"));
        strict_1.default.throws(() => (0, passengers_1.parseEgyptianNationalId)("29013450101234"));
    });
    (0, node_test_1.it)("Age classification and Passport 6-month validity policy work deterministically", () => {
        const travelDate = new Date("2026-12-01T00:00:00Z");
        strict_1.default.equal((0, passengers_1.classifyPassengerAgeOnTravelDate)(new Date("2025-06-01T00:00:00Z"), travelDate).ageClassification, "INFANT");
        strict_1.default.equal((0, passengers_1.classifyPassengerAgeOnTravelDate)(new Date("2018-06-01T00:00:00Z"), travelDate).ageClassification, "CHILD");
        strict_1.default.equal((0, passengers_1.classifyPassengerAgeOnTravelDate)(new Date("1990-05-15T00:00:00Z"), travelDate).ageClassification, "ADULT");
        const validEval = (0, passengers_1.evaluatePassportValidity)(new Date("2027-08-01T00:00:00Z"), travelDate, 6, "REJECT");
        strict_1.default.equal(validEval.isValid, true);
        strict_1.default.throws(() => (0, passengers_1.evaluatePassportValidity)(new Date("2027-03-01T00:00:00Z"), travelDate, 6, "REJECT"));
        const warnEval = (0, passengers_1.evaluatePassportValidity)(new Date("2027-03-01T00:00:00Z"), travelDate, 6, "WARN");
        strict_1.default.equal(Boolean(warnEval.warning), true);
        strict_1.default.equal((0, passengers_1.computeMrzCheckDigit)("A12345678"), (0, passengers_1.computeMrzCheckDigit)("A12345678"));
    });
    (0, node_test_1.it)("Booking state machine enforces valid transitions and blocks illegal transitions", () => {
        strict_1.default.doesNotThrow(() => (0, bookings_1.validateBookingStateTransition)("ON_HOLD", "CONFIRMED"));
        strict_1.default.doesNotThrow(() => (0, bookings_1.validateBookingStateTransition)("CONFIRMED", "CANCELLED"));
        strict_1.default.throws(() => (0, bookings_1.validateBookingStateTransition)("CANCELLED", "CONFIRMED"));
        strict_1.default.throws(() => (0, bookings_1.validateBookingStateTransition)("REFUNDED", "CONFIRMED"));
    });
});
(0, node_test_1.describe)("Integration, Concurrency & Security Suite — End-to-End ERP Workflows", () => {
    let mongodProc = null;
    let dbDir = "";
    let httpServer = null;
    (0, node_test_1.before)(async () => {
        dbDir = await (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "troziana-mongo-test-"));
        const mongoPort = 27200 + Math.floor(Math.random() * 500);
        const mongodBin = "C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe";
        mongodProc = (0, node_child_process_1.spawn)(mongodBin, [
            "--dbpath",
            dbDir,
            "--port",
            String(mongoPort),
            "--bind_ip",
            "127.0.0.1",
            "--replSet",
            "rs0",
            "--quiet",
        ], { stdio: "ignore" });
        let adminConn = null;
        for (let attempt = 0; attempt < 25; attempt++) {
            try {
                adminConn = await mongoose_1.default
                    .createConnection(`mongodb://127.0.0.1:${mongoPort}/admin?directConnection=true`, {
                    serverSelectionTimeoutMS: 1000,
                })
                    .asPromise();
                break;
            }
            catch {
                await new Promise((r) => setTimeout(r, 400));
            }
        }
        if (!adminConn) {
            throw new Error(`Failed to connect to test mongod on port ${mongoPort}`);
        }
        try {
            await adminConn.db.admin().command({
                replSetInitiate: {
                    _id: "rs0",
                    members: [{ _id: 0, host: `127.0.0.1:${mongoPort}` }],
                },
            });
        }
        catch {
        }
        for (let attempt = 0; attempt < 30; attempt++) {
            const hello = await adminConn.db.admin().command({ hello: 1 });
            if (hello.isWritablePrimary || hello.ismaster) {
                break;
            }
            await new Promise((r) => setTimeout(r, 300));
        }
        await adminConn.close();
        await mongoose_1.default.connect(`mongodb://127.0.0.1:${mongoPort}/troziana_erp_test?replicaSet=rs0&directConnection=true`);
        for (const model of Object.values(mongoose_1.default.models)) {
            await model.createCollection().catch(() => { });
        }
        await accounting_1.accountingService.ensureChartOfAccounts();
        await branches_1.branchService.ensureDefaultCompanyAndHQBranch();
        await new Promise((resolve) => {
            httpServer = main_1.default.listen(0, "127.0.0.1", () => {
                const addr = httpServer.address();
                serverUrl = `http://127.0.0.1:${addr.port}`;
                resolve();
            });
        });
    });
    (0, node_test_1.after)(async () => {
        if (httpServer) {
            await new Promise((resolve) => httpServer.close(() => resolve()));
        }
        await mongoose_1.default.disconnect().catch(() => { });
        if (mongodProc) {
            mongodProc.kill();
            await new Promise((r) => setTimeout(r, 800));
        }
        if (dbDir) {
            await (0, promises_1.rm)(dbDir, { recursive: true, force: true }).catch(() => { });
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
    (0, node_test_1.it)("1. Authenticates Super Admin (roleNumber=1), creates Cairo & Alexandria branches, and provisions users across numeric roles", async () => {
        const hqBranch = await module_1.BranchModel.findOne({ code: "HQ-CAI" });
        cairoBranchId = hqBranch._id.toString();
        const adminUser = await module_1.UserModel.create({
            firstName: "Mahmoud",
            lastName: "Owner",
            email: "owner@troziana.com",
            password: "Password123!",
            roleNumber: enum_1.UserRole.SUPER_ADMIN,
            branchId: hqBranch._id,
            primaryBranchId: hqBranch._id,
            canAccessAllBranches: true,
            isActive: true,
            accountStatus: enum_1.UserAccountStatus.ACTIVE,
            confirmEmail: new Date(),
        });
        superAdminId = adminUser._id.toString();
        const loginRes = await apiRequest("POST", "/api/v1/auth/login", {
            body: { email: "owner@troziana.com", password: "Password123!" },
        });
        strict_1.default.equal(loginRes.status, 200);
        strict_1.default.equal(loginRes.body.success, true);
        strict_1.default.equal(loginRes.body.data.roleNumber, enum_1.UserRole.SUPER_ADMIN);
        strict_1.default.equal(loginRes.body.data.roleName, "SUPER_ADMIN");
        superAdminToken = loginRes.body.data.access_token;
        strict_1.default.ok(superAdminToken);
        const meRes = await apiRequest("GET", "/api/v1/auth/me", {
            token: superAdminToken,
        });
        strict_1.default.equal(meRes.status, 200);
        strict_1.default.equal(meRes.body.data.roleNumber, enum_1.UserRole.SUPER_ADMIN);
        strict_1.default.equal(meRes.body.data.roleName, "SUPER_ADMIN");
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
        strict_1.default.equal(alexBranchRes.status, 201);
        alexBranchId = alexBranchRes.body.data._id;
        const genAdminRes = await apiRequest("POST", "/api/v1/users", {
            token: superAdminToken,
            body: {
                name: "Tarek GeneralAdmin",
                email: "admin@troziana.com",
                password: "Password123!",
                roleNumber: enum_1.UserRole.ADMIN,
                branchId: cairoBranchId,
            },
        });
        strict_1.default.equal(genAdminRes.status, 201);
        strict_1.default.equal(genAdminRes.body.data.roleNumber, enum_1.UserRole.ADMIN);
        generalAdminId = genAdminRes.body.data._id;
        const genAdminLogin = await apiRequest("POST", "/api/v1/auth/login", {
            body: { email: "admin@troziana.com", password: "Password123!" },
        });
        generalAdminToken = genAdminLogin.body.data.access_token;
        const cairoStaff = await apiRequest("POST", "/api/v1/users", {
            token: superAdminToken,
            body: {
                firstName: "Ahmed",
                lastName: "Cairo",
                email: "cairo@troziana.com",
                password: "Password123!",
                roleNumber: enum_1.UserRole.BRANCH_MANAGER,
                branchId: cairoBranchId,
            },
        });
        strict_1.default.equal(cairoStaff.status, 201);
        strict_1.default.equal(cairoStaff.body.data.roleNumber, enum_1.UserRole.BRANCH_MANAGER);
        const alexStaff = await apiRequest("POST", "/api/v1/users", {
            token: superAdminToken,
            body: {
                firstName: "Kareem",
                lastName: "Alex",
                email: "alex@troziana.com",
                password: "Password123!",
                roleNumber: enum_1.UserRole.BRANCH_MANAGER,
                branchId: alexBranchId,
            },
        });
        strict_1.default.equal(alexStaff.status, 201);
        const accStaff = await apiRequest("POST", "/api/v1/users", {
            token: generalAdminToken,
            body: {
                name: "Hany Accountant",
                email: "accountant@troziana.com",
                password: "Password123!",
                roleNumber: enum_1.UserRole.ACCOUNTANT,
                branchId: cairoBranchId,
            },
        });
        strict_1.default.equal(accStaff.status, 201);
        const empStaff = await apiRequest("POST", "/api/v1/users", {
            token: generalAdminToken,
            body: {
                name: "Salma Employee",
                email: "employee@troziana.com",
                password: "Password123!",
                roleNumber: enum_1.UserRole.EMPLOYEE,
                branchId: cairoBranchId,
            },
        });
        strict_1.default.equal(empStaff.status, 201);
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
    (0, node_test_1.it)("2. User Management & Role Security: Enforces authorizeRoles, blocks self-role modification, blocks privilege escalation, protects SUPER_ADMIN, and blocks deactivated users", async () => {
        const empCreateUser = await apiRequest("POST", "/api/v1/users", {
            token: employeeToken,
            body: {
                name: "Unauthorized User",
                email: "unauth@troziana.com",
                password: "Password123!",
                roleNumber: enum_1.UserRole.EMPLOYEE,
            },
        });
        strict_1.default.equal(empCreateUser.status, 403);
        const bmCreateUser = await apiRequest("POST", "/api/v1/users", {
            token: cairoBranchToken,
            body: {
                name: "Unauthorized By BM",
                email: "unauth-bm@troziana.com",
                password: "Password123!",
                roleNumber: enum_1.UserRole.EMPLOYEE,
            },
        });
        strict_1.default.equal(bmCreateUser.status, 403);
        const bmListOwnBranch = await apiRequest("GET", "/api/v1/users", {
            token: cairoBranchToken,
        });
        strict_1.default.equal(bmListOwnBranch.status, 200);
        for (const u of bmListOwnBranch.body.data.docs) {
            strict_1.default.equal(u.branchId, cairoBranchId);
        }
        const bmListCrossBranch = await apiRequest("GET", `/api/v1/users?branchId=${alexBranchId}`, {
            token: cairoBranchToken,
        });
        strict_1.default.equal(bmListCrossBranch.status, 403);
        const selfRoleChange = await apiRequest("PATCH", `/api/v1/users/${superAdminId}/role`, {
            token: superAdminToken,
            body: { roleNumber: enum_1.UserRole.ADMIN },
        });
        strict_1.default.equal(selfRoleChange.status, 403);
        const adminEscalateToSuper = await apiRequest("PATCH", `/api/v1/users/${employeeId}/role`, {
            token: generalAdminToken,
            body: { roleNumber: enum_1.UserRole.SUPER_ADMIN },
        });
        strict_1.default.equal(adminEscalateToSuper.status, 403);
        const adminEscalateToAdmin = await apiRequest("PATCH", `/api/v1/users/${employeeId}/role`, {
            token: generalAdminToken,
            body: { roleNumber: enum_1.UserRole.ADMIN },
        });
        strict_1.default.equal(adminEscalateToAdmin.status, 403);
        const adminModifySuper = await apiRequest("PATCH", `/api/v1/users/${superAdminId}`, {
            token: generalAdminToken,
            body: { name: "Hacked Owner" },
        });
        strict_1.default.equal(adminModifySuper.status, 403);
        const adminDeleteSuper = await apiRequest("DELETE", `/api/v1/users/${superAdminId}`, {
            token: generalAdminToken,
        });
        strict_1.default.equal(adminDeleteSuper.status, 403);
        const promoteToSales = await apiRequest("PATCH", `/api/v1/users/${employeeId}/role`, {
            token: generalAdminToken,
            body: { roleNumber: enum_1.UserRole.SALES },
        });
        strict_1.default.equal(promoteToSales.status, 200);
        strict_1.default.equal(promoteToSales.body.data.roleNumber, enum_1.UserRole.SALES);
        strict_1.default.equal(promoteToSales.body.data.roleName, "SALES");
        const revertToEmployee = await apiRequest("PATCH", `/api/v1/users/${employeeId}/role`, {
            token: generalAdminToken,
            body: { roleNumber: enum_1.UserRole.EMPLOYEE },
        });
        strict_1.default.equal(revertToEmployee.status, 200);
        strict_1.default.equal(revertToEmployee.body.data.roleNumber, enum_1.UserRole.EMPLOYEE);
        const empRelogin = await apiRequest("POST", "/api/v1/auth/login", {
            body: { email: "employee@troziana.com", password: "Password123!" },
        });
        strict_1.default.equal(empRelogin.status, 200);
        employeeToken = empRelogin.body.data.access_token;
        const tempUserRes = await apiRequest("POST", "/api/v1/users", {
            token: generalAdminToken,
            body: {
                name: "Temp Procurement User",
                email: "temp.proc@troziana.com",
                password: "Password123!",
                roleNumber: enum_1.UserRole.PROCUREMENT,
                branchId: cairoBranchId,
            },
        });
        strict_1.default.equal(tempUserRes.status, 201);
        const tempUserId = tempUserRes.body.data._id;
        const tempLogin = await apiRequest("POST", "/api/v1/auth/login", {
            body: { email: "temp.proc@troziana.com", password: "Password123!" },
        });
        strict_1.default.equal(tempLogin.status, 200);
        const tempToken = tempLogin.body.data.access_token;
        const deactivateRes = await apiRequest("PATCH", `/api/v1/users/${tempUserId}`, {
            token: generalAdminToken,
            body: { isActive: false, reason: "End of contract" },
        });
        strict_1.default.equal(deactivateRes.status, 200);
        strict_1.default.equal(deactivateRes.body.data.isActive, false);
        const deactivatedAccess = await apiRequest("GET", "/api/v1/auth/me", {
            token: tempToken,
        });
        strict_1.default.equal(deactivatedAccess.status, 403);
        const deleteRes = await apiRequest("DELETE", `/api/v1/users/${tempUserId}`, {
            token: generalAdminToken,
        });
        strict_1.default.equal(deleteRes.status, 200);
        const rawUsers = mongoose_1.default.connection.db.collection("users");
        const legacyInsert = await rawUsers.insertOne({
            firstName: "Legacy",
            lastName: "Staff",
            userName: "Legacy Staff",
            email: "legacy.staff@troziana.com",
            password: "hashedpassword",
            role: "OPERATIONS_MANAGER",
            primaryBranchId: new mongoose_1.default.Types.ObjectId(cairoBranchId),
            accountStatus: "ACTIVE",
        });
        const migrationResult = await (0, migrate_roles_to_roleNumber_1.runRoleNumberMigration)({
            apply: true,
            dropLegacyCollections: false,
        });
        strict_1.default.ok(migrationResult.migratedCount >= 1);
        const migratedDoc = await module_1.UserModel.findById(legacyInsert.insertedId).lean();
        strict_1.default.equal(migratedDoc.roleNumber, enum_1.UserRole.OPERATIONS);
        strict_1.default.equal(migratedDoc.isActive, true);
        strict_1.default.equal(String(migratedDoc.branchId), cairoBranchId);
    });
    (0, node_test_1.it)("3. Procurement & Supplier Ledger: Creates Supplier, Flight Lot, and Hotel Contract with automatic ledger liabilities", async () => {
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
        strict_1.default.equal(forbiddenSup.status, 403);
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
        strict_1.default.equal(supRes.status, 201);
        supplierId = supRes.body.data._id;
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
        strict_1.default.equal(flightRes.status, 201);
        flightLotId = flightRes.body.data._id;
        strict_1.default.equal(flightRes.body.data.totalCost, 50000);
        const hotelRes = await apiRequest("POST", "/api/v1/hotels", {
            token: superAdminToken,
            body: {
                nameAr: "فندق دار التوحيد مكة",
                nameEn: "Dar Al Tawhid Makkah",
                city: "MAKKAH",
                stars: 5,
            },
        });
        strict_1.default.equal(hotelRes.status, 201);
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
        strict_1.default.equal(hcRes.status, 201);
        hotelContractId = hcRes.body.data._id;
        strict_1.default.equal(hcRes.body.data.contractValue, 40000);
        const stmtRes = await apiRequest("GET", `/api/v1/suppliers/${supplierId}/statement`, {
            token: accountantToken,
        });
        strict_1.default.equal(stmtRes.status, 200);
        strict_1.default.equal(stmtRes.body.data.summary.calculatedBalance, 100000);
        strict_1.default.equal(stmtRes.body.data.summary.currentBalance, 100000);
    });
    (0, node_test_1.it)("4. Concurrency Race Test: Two branches attempting to reserve the final seat simultaneously", async () => {
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
        strict_1.default.equal(pvRes.status, 201);
        pricingVersionId = pvRes.body.data._id;
        const approveRes = await apiRequest("PATCH", `/api/v1/pricing/${pricingVersionId}/approve`, {
            token: superAdminToken,
        });
        strict_1.default.equal(approveRes.status, 200);
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
        strict_1.default.equal(tripRes.status, 201);
        sharedTripId = tripRes.body.data._id;
        const [resCairo, resAlex] = await Promise.all([
            (0, utils_1.withTransaction)((session) => quotas_1.quotaService.reserveSeatsAtomically({
                tripId: sharedTripId,
                branchId: cairoBranchId,
                quantity: 1,
                session,
            }))
                .then(() => 201)
                .catch(() => 409),
            (0, utils_1.withTransaction)((session) => quotas_1.quotaService.reserveSeatsAtomically({
                tripId: sharedTripId,
                branchId: alexBranchId,
                quantity: 1,
                session,
            }))
                .then(() => 201)
                .catch(() => 409),
        ]);
        const statuses = [resCairo, resAlex].sort();
        strict_1.default.deepEqual(statuses, [201, 409]);
        const updatedTrip = await module_1.TripModel.findById(sharedTripId).lean();
        strict_1.default.equal(updatedTrip.availableInventory, 0);
        strict_1.default.equal(updatedTrip.reservedSeats, 1);
    });
    (0, node_test_1.it)("5. Idempotency Test: Duplicate reservation requests with the same Idempotency-Key do not double-deduct inventory", async () => {
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
            (0, utils_1.withTransaction)((session) => quotas_1.quotaService.reserveSeatsAtomically({
                tripId: allocatedTripId,
                branchId: cairoBranchId,
                quantity: 1,
                idempotencyKey: idemKey,
                session,
            })),
            (0, utils_1.withTransaction)((session) => quotas_1.quotaService.reserveSeatsAtomically({
                tripId: allocatedTripId,
                branchId: cairoBranchId,
                quantity: 1,
                idempotencyKey: idemKey,
                session,
            })),
        ]);
        strict_1.default.equal(String(firstCall._id), String(secondCall._id));
        const tripAfter = await module_1.TripModel.findById(allocatedTripId).lean();
        strict_1.default.equal(tripAfter.availableInventory, 9);
    });
    (0, node_test_1.it)("6. Branch Isolation, Passenger Registration, Booking Lifecycle, Sensitive Cashbox/Financial Controls & Double-Entry Accounting", async () => {
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
        strict_1.default.equal(paxRes.status, 201);
        const passengerId = paxRes.body.data._id;
        const crossBranchPaxGet = await apiRequest("GET", `/api/v1/passengers/${passengerId}`, {
            token: alexBranchToken,
        });
        strict_1.default.equal(crossBranchPaxGet.status, 404);
        const crossBranchList = await apiRequest("GET", `/api/v1/passengers?branchId=${cairoBranchId}`, {
            token: alexBranchToken,
        });
        strict_1.default.equal(crossBranchList.status, 403);
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
        strict_1.default.equal(bookingRes.status, 201);
        const bookingId = bookingRes.body.data._id;
        const netPrice = bookingRes.body.data.netSellingPrice;
        strict_1.default.equal(bookingRes.body.data.status, "ON_HOLD");
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
        strict_1.default.equal(empCreateCashbox.status, 403);
        const empConfirmBooking = await apiRequest("POST", `/api/v1/bookings/${bookingId}/confirm`, {
            token: employeeToken,
        });
        strict_1.default.equal(empConfirmBooking.status, 403);
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
        strict_1.default.equal(cbRes.status, 201);
        cairoCashboxId = cbRes.body.data._id;
        const rcvRes = await apiRequest("POST", "/api/v1/receipts", {
            token: cairoBranchToken,
            body: {
                bookingId,
                cashboxId: cairoCashboxId,
                amount: 20000,
                paymentMethod: "CASH",
            },
        });
        strict_1.default.equal(rcvRes.status, 201);
        const confirmRes = await apiRequest("POST", `/api/v1/bookings/${bookingId}/confirm`, {
            token: cairoBranchToken,
        });
        strict_1.default.equal(confirmRes.status, 200);
        strict_1.default.equal(confirmRes.body.data.status, "CONFIRMED");
        const manifestRes = await apiRequest("GET", `/api/v1/documents/manifest/${allocatedTripId}`, {
            token: cairoBranchToken,
        });
        strict_1.default.equal(manifestRes.status, 200);
        strict_1.default.equal(manifestRes.body.data.totalPassengers, 1);
        const roomingRes = await apiRequest("GET", `/api/v1/documents/rooming-list/${allocatedTripId}?city=MAKKAH`, {
            token: cairoBranchToken,
        });
        strict_1.default.equal(roomingRes.status, 200);
        strict_1.default.equal(roomingRes.body.data.assignedRooms.length, 1);
        const fsRes = await apiRequest("GET", "/api/v1/accounting/financial-statements", {
            token: accountantToken,
        });
        strict_1.default.equal(fsRes.status, 200);
        strict_1.default.equal(fsRes.body.data.balanceSheet.isBalanced, true);
        strict_1.default.equal(fsRes.body.data.balanceSheet.totalAssets, 120000);
        const reportRes = await apiRequest("GET", `/api/v1/reports/trip-profitability?tripId=${allocatedTripId}`, {
            token: superAdminToken,
        });
        strict_1.default.equal(reportRes.status, 200);
        const tripRep = reportRes.body.data[0];
        strict_1.default.equal(tripRep.operationalActual.bookingsCount, 1);
        strict_1.default.equal(tripRep.operationalActual.revenueEgp, netPrice);
        strict_1.default.equal(tripRep.operationalActual.collectedCashEgp, 20000);
    });
});
