"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditLogsValidator = void 0;
const zod_1 = require("zod");
const listAuditLogsValidator = (_lang) => zod_1.z.object({
    query: zod_1.z
        .object({
        branchId: zod_1.z.string().optional(),
        module: zod_1.z.string().optional(),
        action: zod_1.z.string().optional(),
        entityType: zod_1.z.string().optional(),
        entityId: zod_1.z.string().optional(),
        actorId: zod_1.z.string().optional(),
        fromDate: zod_1.z.string().optional(),
        toDate: zod_1.z.string().optional(),
        page: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
    })
        .optional(),
});
exports.listAuditLogsValidator = listAuditLogsValidator;
