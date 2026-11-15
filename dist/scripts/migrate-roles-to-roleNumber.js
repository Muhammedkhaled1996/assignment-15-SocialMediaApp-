"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRoleNumberMigration = runRoleNumberMigration;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config");
const enum_1 = require("../common/enum");
const LEGACY_ROLE_CODE_MAP = {
    SUPER_ADMIN: enum_1.UserRole.SUPER_ADMIN,
    OWNER: enum_1.UserRole.SUPER_ADMIN,
    GENERAL_MANAGER: enum_1.UserRole.ADMIN,
    ADMIN: enum_1.UserRole.ADMIN,
    BRANCH_MANAGER: enum_1.UserRole.BRANCH_MANAGER,
    FINANCIAL_MANAGER: enum_1.UserRole.ACCOUNTANT,
    ACCOUNTANT: enum_1.UserRole.ACCOUNTANT,
    CASHIER: enum_1.UserRole.ACCOUNTANT,
    WHOLESALE_B2B_MANAGER: enum_1.UserRole.SALES,
    SALES: enum_1.UserRole.SALES,
    BOOKING_AGENT: enum_1.UserRole.SALES,
    PROCUREMENT_MANAGER: enum_1.UserRole.PROCUREMENT,
    PROCUREMENT: enum_1.UserRole.PROCUREMENT,
    OPERATIONS_MANAGER: enum_1.UserRole.OPERATIONS,
    OPERATIONS: enum_1.UserRole.OPERATIONS,
    SUPERVISOR: enum_1.UserRole.OPERATIONS,
    AUDITOR: enum_1.UserRole.ADMIN,
    EMPLOYEE: enum_1.UserRole.EMPLOYEE,
    USER: enum_1.UserRole.EMPLOYEE,
};
function resolveRoleFromLegacyString(rawRole) {
    if (typeof rawRole === "number" && (0, enum_1.isValidUserRole)(rawRole)) {
        return rawRole;
    }
    if (typeof rawRole === "string" && rawRole.trim()) {
        const normalized = rawRole.trim().toUpperCase().replace(/[\s-]+/g, "_");
        if (LEGACY_ROLE_CODE_MAP[normalized]) {
            return LEGACY_ROLE_CODE_MAP[normalized];
        }
        const asNum = Number(normalized);
        if ((0, enum_1.isValidUserRole)(asNum)) {
            return asNum;
        }
    }
    return null;
}
async function runRoleNumberMigration(options) {
    const db = mongoose_1.default.connection.db;
    if (!db) {
        throw new Error("Database connection is not established.");
    }
    const usersColl = db.collection("users");
    const collections = await db.listCollections().toArray();
    const collectionNames = new Set(collections.map((c) => c.name));
    const legacyUserRoleLookup = new Map();
    if (collectionNames.has("userroles")) {
        const legacyAssignments = await db
            .collection("userroles")
            .find({ status: { $ne: "REVOKED" } })
            .toArray();
        for (const assignment of legacyAssignments) {
            const uid = String(assignment.userId || "");
            const mapped = resolveRoleFromLegacyString(assignment.roleCode);
            if (uid && mapped) {
                const existing = legacyUserRoleLookup.get(uid);
                if (!existing || mapped < existing) {
                    legacyUserRoleLookup.set(uid, mapped);
                }
            }
        }
    }
    const allUsers = await usersColl.find({}).toArray();
    let totalUsersScanned = 0;
    let alreadyValidCount = 0;
    let migratedCount = 0;
    let defaultedToEmployeeCount = 0;
    for (const userDoc of allUsers) {
        totalUsersScanned++;
        const userIdStr = String(userDoc._id);
        let targetRoleNumber = null;
        if ((0, enum_1.isValidUserRole)(userDoc.roleNumber)) {
            targetRoleNumber = userDoc.roleNumber;
        }
        if (!targetRoleNumber && legacyUserRoleLookup.has(userIdStr)) {
            targetRoleNumber = legacyUserRoleLookup.get(userIdStr);
        }
        if (!targetRoleNumber && userDoc.role) {
            targetRoleNumber = resolveRoleFromLegacyString(userDoc.role);
        }
        if (!targetRoleNumber && Array.isArray(userDoc.roles) && userDoc.roles.length > 0) {
            for (const r of userDoc.roles) {
                const resolved = resolveRoleFromLegacyString(typeof r === "object" && r !== null ? r.code || r.name : r);
                if (resolved && (!targetRoleNumber || resolved < targetRoleNumber)) {
                    targetRoleNumber = resolved;
                }
            }
        }
        if (!targetRoleNumber) {
            if (userDoc.canAccessAllBranches === true) {
                targetRoleNumber = enum_1.UserRole.SUPER_ADMIN;
            }
            else {
                targetRoleNumber = enum_1.UserRole.EMPLOYEE;
                defaultedToEmployeeCount++;
            }
        }
        const targetBranchId = userDoc.branchId ?? userDoc.primaryBranchId ?? null;
        const targetPrimaryBranchId = userDoc.primaryBranchId ?? userDoc.branchId ?? null;
        const targetIsActive = typeof userDoc.isActive === "boolean"
            ? userDoc.isActive
            : userDoc.accountStatus
                ? userDoc.accountStatus === "ACTIVE"
                : true;
        const targetAccountStatus = targetIsActive
            ? "ACTIVE"
            : userDoc.accountStatus && userDoc.accountStatus !== "ACTIVE"
                ? userDoc.accountStatus
                : "SUSPENDED";
        const targetCanAccessAllBranches = targetRoleNumber === enum_1.UserRole.SUPER_ADMIN || targetRoleNumber === enum_1.UserRole.ADMIN
            ? true
            : Boolean(userDoc.canAccessAllBranches);
        const needsUpdate = userDoc.roleNumber !== targetRoleNumber ||
            String(userDoc.branchId ?? null) !== String(targetBranchId ?? null) ||
            String(userDoc.primaryBranchId ?? null) !== String(targetPrimaryBranchId ?? null) ||
            userDoc.isActive !== targetIsActive ||
            userDoc.accountStatus !== targetAccountStatus ||
            userDoc.canAccessAllBranches !== targetCanAccessAllBranches ||
            "role" in userDoc ||
            "roles" in userDoc ||
            "permissions" in userDoc;
        if (!needsUpdate) {
            alreadyValidCount++;
            continue;
        }
        migratedCount++;
        console.log(`[${options.apply ? "APPLY" : "DRY-RUN"}] User ${userDoc.email || userIdStr}: roleNumber=${targetRoleNumber} (${enum_1.USER_ROLE_LABELS[targetRoleNumber]}), isActive=${targetIsActive}, branchId=${targetBranchId ?? "null"}`);
        if (options.apply) {
            await usersColl.updateOne({ _id: userDoc._id }, {
                $set: {
                    roleNumber: targetRoleNumber,
                    branchId: targetBranchId,
                    primaryBranchId: targetPrimaryBranchId,
                    isActive: targetIsActive,
                    accountStatus: targetAccountStatus,
                    canAccessAllBranches: targetCanAccessAllBranches,
                },
                $unset: {
                    role: "",
                    roles: "",
                    permissions: "",
                },
            });
        }
    }
    const legacyCollectionsDropped = [];
    if (options.apply && options.dropLegacyCollections) {
        for (const legacyName of ["userroles", "roles", "permissions"]) {
            if (collectionNames.has(legacyName)) {
                await db.collection(legacyName).drop();
                legacyCollectionsDropped.push(legacyName);
                console.log(`[APPLY] Dropped legacy collection: ${legacyName}`);
            }
        }
    }
    return {
        totalUsersScanned,
        alreadyValidCount,
        migratedCount,
        defaultedToEmployeeCount,
        legacyCollectionsDropped,
    };
}
if (require.main === module) {
    const args = process.argv.slice(2);
    const apply = args.includes("--apply");
    const dropLegacyCollections = args.includes("--drop-legacy-collections");
    (async () => {
        console.log(`Connecting to MongoDB (${config_1.DB_URI})...`);
        await mongoose_1.default.connect(config_1.DB_URI);
        const summary = await runRoleNumberMigration({ apply, dropLegacyCollections });
        console.log("Migration Summary:", JSON.stringify(summary, null, 2));
        await mongoose_1.default.disconnect();
        process.exit(0);
    })().catch((err) => {
        console.error("Migration failed:", err);
        process.exit(1);
    });
}
