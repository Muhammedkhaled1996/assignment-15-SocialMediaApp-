"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacService = exports.RbacService = exports.DEFAULT_SYSTEM_ROLES = exports.SYSTEM_PERMISSIONS = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const permission_model_1 = require("../../DB/module/permission.model");
const role_model_1 = require("../../DB/module/role.model");
const userRole_model_1 = require("../../DB/module/userRole.model");
const userRole_enum_1 = require("../enum/userRole.enum");
exports.SYSTEM_PERMISSIONS = [
    { code: "users.read", name: "Read Users", module: "users", action: "read", description: "View user accounts" },
    { code: "users.create", name: "Create Users", module: "users", action: "create", description: "Create new staff accounts" },
    { code: "users.update", name: "Update Users", module: "users", action: "update", description: "Edit user accounts and status" },
    { code: "users.delete", name: "Delete Users", module: "users", action: "delete", description: "Archive or remove user accounts" },
    { code: "roles.read", name: "Read Roles", module: "roles", action: "read", description: "View roles and permissions" },
    { code: "roles.manage", name: "Manage Roles", module: "roles", action: "manage", description: "Create, update, assign, and revoke roles" },
    { code: "branches.read", name: "Read Branches", module: "branches", action: "read", description: "View branch information" },
    { code: "branches.manage", name: "Manage Branches", module: "branches", action: "manage", description: "Create and update branches" },
    { code: "suppliers.read", name: "Read Suppliers", module: "suppliers", action: "read", description: "View suppliers and ledgers" },
    { code: "suppliers.create", name: "Create Suppliers", module: "suppliers", action: "create", description: "Create suppliers" },
    { code: "suppliers.update", name: "Update Suppliers", module: "suppliers", action: "update", description: "Update suppliers and record ledger entries" },
    { code: "flights.read", name: "Read Flights", module: "flights", action: "read", description: "View flight lots" },
    { code: "flights.create", name: "Create Flights", module: "flights", action: "create", description: "Create flight procurement lots" },
    { code: "flights.update", name: "Update Flights", module: "flights", action: "update", description: "Update flight lots" },
    { code: "flights.archive", name: "Archive Flights", module: "flights", action: "archive", description: "Archive flight lots" },
    { code: "hotels.read", name: "Read Hotels", module: "hotels", action: "read", description: "View hotels and hotel contracts" },
    { code: "hotels.create", name: "Create Hotels", module: "hotels", action: "create", description: "Create hotels and contracts" },
    { code: "hotels.update", name: "Update Hotels", module: "hotels", action: "update", description: "Update hotel contracts and amendments" },
    { code: "pricing.read", name: "Read Pricing", module: "pricing", action: "read", description: "View pricing versions and cost sheets" },
    { code: "pricing.create", name: "Create Pricing", module: "pricing", action: "create", description: "Create pricing scenarios" },
    { code: "pricing.approve", name: "Approve Pricing", module: "pricing", action: "approve", description: "Approve pricing versions for trips" },
    { code: "trips.read", name: "Read Trips", module: "trips", action: "read", description: "View trips and groups" },
    { code: "trips.create", name: "Create Trips", module: "trips", action: "create", description: "Create trips and groups" },
    { code: "trips.update", name: "Update Trips", module: "trips", action: "update", description: "Update trips and groups" },
    { code: "quotas.read", name: "Read Quotas", module: "quotas", action: "read", description: "View seat quotas and movements" },
    { code: "quotas.manage", name: "Manage Quotas", module: "quotas", action: "manage", description: "Allocate, transfer, release, and reconcile quotas" },
    { code: "passengers.read", name: "Read Passengers", module: "passengers", action: "read", description: "View passenger profiles and passports" },
    { code: "passengers.create", name: "Create Passengers", module: "passengers", action: "create", description: "Register passengers" },
    { code: "passengers.update", name: "Update Passengers", module: "passengers", action: "update", description: "Edit passenger and passport details" },
    { code: "bookings.read", name: "Read Bookings", module: "bookings", action: "read", description: "View passenger bookings" },
    { code: "bookings.create", name: "Create Bookings", module: "bookings", action: "create", description: "Create passenger bookings" },
    { code: "bookings.update", name: "Update Bookings", module: "bookings", action: "update", description: "Edit bookings and transfers" },
    { code: "bookings.confirm", name: "Confirm Bookings", module: "bookings", action: "confirm", description: "Confirm bookings" },
    { code: "bookings.cancel", name: "Cancel Bookings", module: "bookings", action: "cancel", description: "Cancel and refund bookings" },
    { code: "wholesale.read", name: "Read Wholesale", module: "wholesale", action: "read", description: "View wholesale partners and contracts" },
    { code: "wholesale.manage", name: "Manage Wholesale", module: "wholesale", action: "manage", description: "Create and manage wholesale allocations" },
    { code: "finance.cashboxes.read", name: "Read Cashboxes", module: "finance", action: "read", description: "View cashboxes and balances" },
    { code: "finance.cashboxes.manage", name: "Manage Cashboxes", module: "finance", action: "manage", description: "Create, close, and reconcile cashboxes" },
    { code: "finance.receipts.read", name: "Read Receipts", module: "finance", action: "read", description: "View customer receipts" },
    { code: "finance.receipts.create", name: "Create Receipts", module: "finance", action: "create", description: "Issue customer receipts" },
    { code: "finance.receipts.approve", name: "Approve Receipts", module: "finance", action: "approve", description: "Approve or reverse receipts" },
    { code: "finance.expenses.read", name: "Read Expenses", module: "finance", action: "read", description: "View expenses and payment vouchers" },
    { code: "finance.expenses.create", name: "Create Expenses", module: "finance", action: "create", description: "Record expenses and supplier payments" },
    { code: "finance.transfers.manage", name: "Manage Transfers", module: "finance", action: "manage", description: "Create and approve cashbox transfers" },
    { code: "accounting.read", name: "Read Accounting", module: "accounting", action: "read", description: "View chart of accounts, journal entries, and trial balance" },
    { code: "accounting.manage", name: "Manage Accounting", module: "accounting", action: "manage", description: "Post and reverse journal entries and manage periods" },
    { code: "documents.read", name: "Read Documents", module: "documents", action: "read", description: "Generate flyers, manifests, rooming lists, and receipts" },
    { code: "reports.read", name: "Read Reports", module: "reports", action: "read", description: "View operational and financial reports" },
    { code: "reports.export", name: "Export Reports", module: "reports", action: "export", description: "Export reports to Excel/PDF" },
    { code: "audit.read", name: "Read Audit Logs", module: "audit", action: "read", description: "Inspect system audit logs" },
    { code: "settings.manage", name: "Manage Settings", module: "settings", action: "manage", description: "Manage system settings and templates" },
];
exports.DEFAULT_SYSTEM_ROLES = [
    {
        code: userRole_enum_1.SystemRoleCode.SUPER_ADMIN,
        name: "Super Admin / Owner",
        description: "Full unrestricted access to all modules and branches",
        allowsAllBranches: true,
        permissions: ["*"],
    },
    {
        code: userRole_enum_1.SystemRoleCode.GENERAL_MANAGER,
        name: "General Manager",
        description: "Executive access across all branches, approvals, pricing, and reports",
        allowsAllBranches: true,
        permissions: exports.SYSTEM_PERMISSIONS.map((p) => p.code),
    },
    {
        code: userRole_enum_1.SystemRoleCode.OPERATIONS_MANAGER,
        name: "Operations Manager",
        description: "Manages procurement, flights, hotels, pricing, trips, quotas, manifests, and rooming lists",
        allowsAllBranches: true,
        permissions: [
            "branches.read",
            "suppliers.read",
            "suppliers.create",
            "suppliers.update",
            "flights.read",
            "flights.create",
            "flights.update",
            "flights.archive",
            "hotels.read",
            "hotels.create",
            "hotels.update",
            "pricing.read",
            "pricing.create",
            "pricing.approve",
            "trips.read",
            "trips.create",
            "trips.update",
            "quotas.read",
            "quotas.manage",
            "passengers.read",
            "passengers.create",
            "passengers.update",
            "bookings.read",
            "bookings.create",
            "bookings.update",
            "bookings.confirm",
            "bookings.cancel",
            "wholesale.read",
            "wholesale.manage",
            "documents.read",
            "reports.read",
            "reports.export",
        ],
    },
    {
        code: userRole_enum_1.SystemRoleCode.ACCOUNTANT,
        name: "Accountant",
        description: "Manages cashboxes, receipts, supplier payments, expenses, transfers, and double-entry accounting",
        allowsAllBranches: true,
        permissions: [
            "branches.read",
            "suppliers.read",
            "suppliers.update",
            "flights.read",
            "hotels.read",
            "pricing.read",
            "trips.read",
            "bookings.read",
            "wholesale.read",
            "finance.cashboxes.read",
            "finance.cashboxes.manage",
            "finance.receipts.read",
            "finance.receipts.create",
            "finance.receipts.approve",
            "finance.expenses.read",
            "finance.expenses.create",
            "finance.transfers.manage",
            "accounting.read",
            "accounting.manage",
            "documents.read",
            "reports.read",
            "reports.export",
        ],
    },
    {
        code: userRole_enum_1.SystemRoleCode.BRANCH_MANAGER,
        name: "Branch Manager",
        description: "Manages branch operations, bookings, confirmations, branch cashbox, receipts, and branch reports",
        allowsAllBranches: false,
        permissions: [
            "branches.read",
            "trips.read",
            "quotas.read",
            "passengers.read",
            "passengers.create",
            "passengers.update",
            "bookings.read",
            "bookings.create",
            "bookings.update",
            "bookings.confirm",
            "bookings.cancel",
            "finance.cashboxes.read",
            "finance.cashboxes.manage",
            "finance.receipts.read",
            "finance.receipts.create",
            "finance.expenses.read",
            "finance.expenses.create",
            "documents.read",
            "reports.read",
        ],
    },
    {
        code: userRole_enum_1.SystemRoleCode.BRANCH_EMPLOYEE,
        name: "Branch Employee",
        description: "Branch POS sales agent: registers passengers, creates bookings, and collects customer receipts",
        allowsAllBranches: false,
        permissions: [
            "branches.read",
            "trips.read",
            "quotas.read",
            "passengers.read",
            "passengers.create",
            "passengers.update",
            "bookings.read",
            "bookings.create",
            "bookings.update",
            "finance.cashboxes.read",
            "finance.receipts.read",
            "finance.receipts.create",
            "documents.read",
        ],
    },
    {
        code: userRole_enum_1.SystemRoleCode.READ_ONLY,
        name: "Read Only Auditor",
        description: "Read-only inspection of trips, bookings, documents, and reports",
        allowsAllBranches: false,
        permissions: [
            "branches.read",
            "suppliers.read",
            "flights.read",
            "hotels.read",
            "pricing.read",
            "trips.read",
            "quotas.read",
            "passengers.read",
            "bookings.read",
            "wholesale.read",
            "finance.cashboxes.read",
            "finance.receipts.read",
            "finance.expenses.read",
            "accounting.read",
            "documents.read",
            "reports.read",
        ],
    },
];
class RbacService {
    async seedSystemRbac() {
        const permOps = exports.SYSTEM_PERMISSIONS.map((perm) => ({
            updateOne: {
                filter: { code: perm.code },
                update: { $setOnInsert: { ...perm, isSystem: true } },
                upsert: true,
            },
        }));
        if (permOps.length > 0) {
            await permission_model_1.PermissionModel.bulkWrite(permOps);
        }
        for (const r of exports.DEFAULT_SYSTEM_ROLES) {
            await role_model_1.RoleModel.updateOne({ code: r.code }, {
                $setOnInsert: {
                    name: r.name,
                    code: r.code,
                    description: r.description,
                    permissions: r.permissions,
                    allowsAllBranches: r.allowsAllBranches,
                    isSystemRole: true,
                    status: "ACTIVE",
                },
            }, { upsert: true });
        }
    }
    async resolveUserContext(user, requestedBranchId) {
        const userId = user._id?.toString() || user.id;
        const roleCodes = new Set();
        const permissions = new Set();
        const branchPermissions = {};
        let allowsAllBranches = Boolean(user.canAccessAllBranches);
        if (userId && mongoose_1.default.Types.ObjectId.isValid(userId)) {
            const assignments = await userRole_model_1.UserRoleModel.find({
                userId: new mongoose_1.default.Types.ObjectId(userId),
                status: "ACTIVE",
            }).lean();
            if (assignments.length > 0) {
                const roleIds = assignments.map((a) => a.roleId);
                const roles = await role_model_1.RoleModel.find({
                    _id: { $in: roleIds },
                    status: "ACTIVE",
                }).lean();
                const roleMap = new Map(roles.map((r) => [r._id.toString(), r]));
                for (const assignment of assignments) {
                    const role = roleMap.get(assignment.roleId.toString());
                    if (!role)
                        continue;
                    roleCodes.add(role.code);
                    if (role.allowsAllBranches || role.code === userRole_enum_1.SystemRoleCode.SUPER_ADMIN) {
                        allowsAllBranches = true;
                    }
                    for (const perm of role.permissions) {
                        permissions.add(perm);
                        if (assignment.branchId) {
                            const bId = assignment.branchId.toString();
                            branchPermissions[bId] = branchPermissions[bId] || [];
                            if (!branchPermissions[bId].includes(perm)) {
                                branchPermissions[bId].push(perm);
                            }
                        }
                    }
                }
            }
        }
        const allowedBranchesSet = new Set();
        if (user.primaryBranchId) {
            allowedBranchesSet.add(user.primaryBranchId.toString());
        }
        if (Array.isArray(user.assignedBranchIds)) {
            for (const b of user.assignedBranchIds) {
                if (b)
                    allowedBranchesSet.add(b.toString());
            }
        }
        for (const bId of Object.keys(branchPermissions)) {
            allowedBranchesSet.add(bId);
        }
        const allowedBranchIds = Array.from(allowedBranchesSet);
        let activeBranchId = user.primaryBranchId?.toString() || allowedBranchIds[0];
        if (requestedBranchId && mongoose_1.default.Types.ObjectId.isValid(requestedBranchId)) {
            if (allowsAllBranches || allowedBranchesSet.has(requestedBranchId)) {
                activeBranchId = requestedBranchId;
            }
        }
        return {
            rbac: {
                roleCodes: Array.from(roleCodes),
                permissions: Array.from(permissions),
                branchPermissions,
            },
            branchContext: {
                isCentralAdmin: allowsAllBranches,
                allowedBranchIds,
                activeBranchId,
                companyId: user.companyId?.toString(),
            },
        };
    }
    hasPermission(rbac, permission, branchId) {
        if (!rbac)
            return false;
        if (rbac.permissions.includes("*"))
            return true;
        if (branchId && rbac.branchPermissions[branchId]) {
            const branchPerms = rbac.branchPermissions[branchId];
            if (branchPerms.includes("*") || branchPerms.includes(permission))
                return true;
        }
        return rbac.permissions.includes(permission);
    }
}
exports.RbacService = RbacService;
exports.rbacService = new RbacService();
