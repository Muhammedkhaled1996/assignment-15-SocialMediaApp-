"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionsController = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const createPermissionValidator = (_lang) => zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2),
        code: zod_1.z.string().min(3),
        module: zod_1.z.string().min(2),
        action: zod_1.z.string().min(2),
        description: zod_1.z.string().optional(),
    }),
});
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.read"), (0, middleware_1.responceFormatter)(async (req) => {
    await service_1.rbacService.seedSystemRbac();
    const filter = {};
    if (req.query.module)
        filter.module = String(req.query.module).toLowerCase();
    const permissions = await module_1.PermissionModel.find(filter).sort({ module: 1, code: 1 }).lean();
    return { data: permissions };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.hasPermission)("roles.manage"), (0, middleware_1.validation)(createPermissionValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const body = req.validate.body;
    const code = body.code.toLowerCase().trim();
    const exists = await module_1.PermissionModel.findOne({ code });
    if (exists) {
        throw new exception_1.ConflictException(`Permission ${code} already exists`);
    }
    const created = await module_1.PermissionModel.create({
        ...body,
        code,
        isSystem: false,
    });
    await service_1.auditService.record({
        req,
        action: "PERMISSION_CREATED",
        module: "permissions",
        entityType: "Permission",
        entityId: created._id.toString(),
        newValues: created.toObject(),
    });
    return { status: 201, data: created };
}));
exports.permissionsController = router;
exports.default = router;
