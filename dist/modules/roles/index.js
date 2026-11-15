"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolesController = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../common/utils");
const createRoleValidator = (_lang) => zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2),
        code: zod_1.z.string().min(2),
        description: zod_1.z.string().optional(),
        permissions: zod_1.z.array(zod_1.z.string()).min(1),
        allowsAllBranches: zod_1.z.boolean().optional(),
        status: zod_1.z.enum(["ACTIVE", "INACTIVE"]).optional(),
    }),
});
const updateRoleValidator = (lang) => zod_1.z.object({
    params: zod_1.z.object({ id: utils_1.generalValidationFields.id(lang) }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).optional(),
        description: zod_1.z.string().optional(),
        permissions: zod_1.z.array(zod_1.z.string()).optional(),
        allowsAllBranches: zod_1.z.boolean().optional(),
        status: zod_1.z.enum(["ACTIVE", "INACTIVE"]).optional(),
    }),
});
const assignRoleValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        userId: utils_1.generalValidationFields.id(lang),
        roleId: utils_1.generalValidationFields.id(lang),
        branchId: utils_1.generalValidationFields.id(lang).nullable().optional(),
    }),
});
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.read"), (0, middleware_1.responceFormatter)(async () => {
    await service_1.rbacService.seedSystemRbac();
    const roles = await module_1.RoleModel.find().sort({ isSystemRole: -1, code: 1 }).lean();
    return { data: roles };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.manage"), (0, middleware_1.validation)(createRoleValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const body = req.validate.body;
    const code = body.code.toUpperCase().trim();
    const exists = await module_1.RoleModel.findOne({ code });
    if (exists) {
        throw new exception_1.ConflictException(`Role with code ${code} already exists`);
    }
    const role = await module_1.RoleModel.create({
        ...body,
        code,
        isSystemRole: false,
        createdBy: req.user?._id,
    });
    await service_1.auditService.record({
        req,
        action: "ROLE_CREATED",
        module: "roles",
        entityType: "Role",
        entityId: role._id.toString(),
        newValues: role.toObject(),
    });
    return { status: 201, data: role };
}));
router.patch("/:id", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.manage"), (0, middleware_1.validation)(updateRoleValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const role = await module_1.RoleModel.findById(req.validate.params.id);
    if (!role)
        throw new exception_1.NotFoundException("Role not found");
    const prev = role.toObject();
    Object.assign(role, req.validate.body, { updatedBy: req.user?._id });
    await role.save();
    await service_1.auditService.record({
        req,
        action: "ROLE_UPDATED",
        module: "roles",
        entityType: "Role",
        entityId: role._id.toString(),
        previousValues: prev,
        newValues: role.toObject(),
    });
    return { data: role };
}));
router.delete("/:id", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.manage"), (0, middleware_1.responceFormatter)(async (req) => {
    const role = await module_1.RoleModel.findById(req.params.id);
    if (!role)
        throw new exception_1.NotFoundException("Role not found");
    if (role.isSystemRole) {
        throw new exception_1.BadRequestException("System-defined roles cannot be deleted");
    }
    const activeCount = await module_1.UserRoleModel.countDocuments({ roleId: role._id, status: "ACTIVE" });
    if (activeCount > 0) {
        throw new exception_1.ConflictException("Cannot delete role while users are actively assigned to it");
    }
    await module_1.RoleModel.deleteOne({ _id: role._id });
    await service_1.auditService.record({
        req,
        action: "ROLE_DELETED",
        module: "roles",
        entityType: "Role",
        entityId: role._id.toString(),
        previousValues: role.toObject(),
    });
    return { data: { deleted: true } };
}));
router.post("/assign", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.manage"), (0, middleware_1.validation)(assignRoleValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const { userId, roleId, branchId } = req.validate.body;
    const role = await module_1.RoleModel.findById(roleId);
    if (!role || role.status !== "ACTIVE") {
        throw new exception_1.NotFoundException("Active role not found");
    }
    const existing = await module_1.UserRoleModel.findOne({
        userId,
        roleId,
        branchId: branchId || null,
        status: "ACTIVE",
    });
    if (existing) {
        throw new exception_1.ConflictException("User already holds this active role assignment");
    }
    const assignment = await module_1.UserRoleModel.create({
        userId,
        roleId,
        roleCode: role.code,
        branchId: branchId || null,
        status: "ACTIVE",
        assignedBy: req.user?._id,
    });
    await service_1.auditService.record({
        req,
        action: "USER_ROLE_ASSIGNED",
        module: "roles",
        entityType: "UserRoleAssignment",
        entityId: assignment._id.toString(),
        branchId: branchId || null,
        newValues: assignment.toObject(),
    });
    return { status: 201, data: assignment };
}));
router.patch("/assignments/:assignmentId/revoke", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.manage"), (0, middleware_1.responceFormatter)(async (req) => {
    const assignment = await module_1.UserRoleModel.findById(req.params.assignmentId);
    if (!assignment) {
        throw new exception_1.NotFoundException("Role assignment not found");
    }
    assignment.status = "REVOKED";
    assignment.revokedBy = req.user?._id;
    assignment.revokedAt = new Date();
    await assignment.save();
    await service_1.auditService.record({
        req,
        action: "USER_ROLE_REVOKED",
        module: "roles",
        entityType: "UserRoleAssignment",
        entityId: assignment._id.toString(),
        branchId: assignment.branchId,
        newValues: assignment.toObject(),
    });
    return { data: assignment };
}));
router.get("/user/:userId", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.read"), (0, middleware_1.responceFormatter)(async (req) => {
    const assignments = await module_1.UserRoleModel.find({
        userId: req.params.userId,
        status: "ACTIVE",
    })
        .populate("roleId")
        .populate("branchId", "code nameAr nameEn")
        .lean();
    return { data: assignments };
}));
exports.rolesController = router;
exports.default = router;
