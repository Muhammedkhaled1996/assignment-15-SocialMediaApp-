/**
 * ============================================================================
 * IDEMPOTENT DATABASE MIGRATION: Legacy RBAC -> Numeric Role System (`roleNumber`)
 * ============================================================================
 *
 * Usage:
 *   1. Dry-run (safe inspection, no writes):
 *      npx ts-node src/scripts/migrate-roles-to-roleNumber.ts --dry-run
 *
 *   2. Execute migration (applies updates idempotently):
 *      npx ts-node src/scripts/migrate-roles-to-roleNumber.ts --apply
 *
 *   3. Execute migration + drop legacy RBAC collections (`roles`, `permissions`, `userroles`):
 *      npx ts-node src/scripts/migrate-roles-to-roleNumber.ts --apply --drop-legacy-collections
 *
 * Pre-Migration Backup Recommendation:
 *   mongodump --uri="$DB_URI" --out="./backups/pre-roleNumber-migration-$(date +%Y%m%d)"
 */

import mongoose from "mongoose";
import { DB_URI } from "../config";
import { UserRole, USER_ROLE_LABELS, isValidUserRole } from "../common/enum";

const LEGACY_ROLE_CODE_MAP: Record<string, UserRole> = {
  SUPER_ADMIN: UserRole.SUPER_ADMIN,
  OWNER: UserRole.SUPER_ADMIN,
  GENERAL_MANAGER: UserRole.ADMIN,
  ADMIN: UserRole.ADMIN,
  BRANCH_MANAGER: UserRole.BRANCH_MANAGER,
  FINANCIAL_MANAGER: UserRole.ACCOUNTANT,
  ACCOUNTANT: UserRole.ACCOUNTANT,
  CASHIER: UserRole.ACCOUNTANT,
  WHOLESALE_B2B_MANAGER: UserRole.SALES,
  SALES: UserRole.SALES,
  BOOKING_AGENT: UserRole.SALES,
  PROCUREMENT_MANAGER: UserRole.PROCUREMENT,
  PROCUREMENT: UserRole.PROCUREMENT,
  OPERATIONS_MANAGER: UserRole.OPERATIONS,
  OPERATIONS: UserRole.OPERATIONS,
  SUPERVISOR: UserRole.OPERATIONS,
  AUDITOR: UserRole.ADMIN,
  EMPLOYEE: UserRole.EMPLOYEE,
  USER: UserRole.EMPLOYEE,
};

function resolveRoleFromLegacyString(rawRole: unknown): UserRole | null {
  if (typeof rawRole === "number" && isValidUserRole(rawRole)) {
    return rawRole;
  }
  if (typeof rawRole === "string" && rawRole.trim()) {
    const normalized = rawRole.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (LEGACY_ROLE_CODE_MAP[normalized]) {
      return LEGACY_ROLE_CODE_MAP[normalized];
    }
    const asNum = Number(normalized);
    if (isValidUserRole(asNum)) {
      return asNum;
    }
  }
  return null;
}

export async function runRoleNumberMigration(options: {
  apply: boolean;
  dropLegacyCollections: boolean;
}): Promise<{
  totalUsersScanned: number;
  alreadyValidCount: number;
  migratedCount: number;
  defaultedToEmployeeCount: number;
  legacyCollectionsDropped: string[];
}> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection is not established.");
  }

  const usersColl = db.collection("users");
  const collections = await db.listCollections().toArray();
  const collectionNames = new Set(collections.map((c) => c.name));

  // Build lookup of legacy userroles -> highest-privilege roleCode (lowest roleNumber)
  const legacyUserRoleLookup = new Map<string, UserRole>();
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
        // Keep the highest privilege (lowest numeric value) if a user had multiple legacy roles
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

    let targetRoleNumber: UserRole | null = null;

    // 1. Check if user already has a valid numeric roleNumber
    if (isValidUserRole(userDoc.roleNumber)) {
      targetRoleNumber = userDoc.roleNumber;
    }

    // 2. Otherwise inspect legacy `userroles` assignment collection
    if (!targetRoleNumber && legacyUserRoleLookup.has(userIdStr)) {
      targetRoleNumber = legacyUserRoleLookup.get(userIdStr)!;
    }

    // 3. Otherwise inspect legacy `role` string or array on user document
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

    // 4. Fallback for missing or unrecognized roles
    if (!targetRoleNumber) {
      if (userDoc.canAccessAllBranches === true) {
        targetRoleNumber = UserRole.SUPER_ADMIN;
      } else {
        targetRoleNumber = UserRole.EMPLOYEE;
        defaultedToEmployeeCount++;
      }
    }

    const targetBranchId = userDoc.branchId ?? userDoc.primaryBranchId ?? null;
    const targetPrimaryBranchId = userDoc.primaryBranchId ?? userDoc.branchId ?? null;
    const targetIsActive =
      typeof userDoc.isActive === "boolean"
        ? userDoc.isActive
        : userDoc.accountStatus
          ? userDoc.accountStatus === "ACTIVE"
          : true;
    const targetAccountStatus = targetIsActive
      ? "ACTIVE"
      : userDoc.accountStatus && userDoc.accountStatus !== "ACTIVE"
        ? userDoc.accountStatus
        : "SUSPENDED";
    const targetCanAccessAllBranches =
      targetRoleNumber === UserRole.SUPER_ADMIN || targetRoleNumber === UserRole.ADMIN
        ? true
        : Boolean(userDoc.canAccessAllBranches);

    const needsUpdate =
      userDoc.roleNumber !== targetRoleNumber ||
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
    console.log(
      `[${options.apply ? "APPLY" : "DRY-RUN"}] User ${userDoc.email || userIdStr}: roleNumber=${targetRoleNumber} (${USER_ROLE_LABELS[targetRoleNumber]}), isActive=${targetIsActive}, branchId=${targetBranchId ?? "null"}`,
    );

    if (options.apply) {
      await usersColl.updateOne(
        { _id: userDoc._id },
        {
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
        },
      );
    }
  }

  const legacyCollectionsDropped: string[] = [];
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
    console.log(`Connecting to MongoDB (${DB_URI})...`);
    await mongoose.connect(DB_URI);
    const summary = await runRoleNumberMigration({ apply, dropLegacyCollections });
    console.log("Migration Summary:", JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
