"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.journalEntriesQueryValidator = void 0;
const zod_1 = require("zod");
const journalEntriesQueryValidator = (_lang) => zod_1.z.object({
    query: zod_1.z.object({
        sourceModule: zod_1.z.string().optional(),
        branchId: zod_1.z.string().optional(),
        tripId: zod_1.z.string().optional(),
        status: zod_1.z.enum(["POSTED", "REVERSED"]).optional(),
        limit: zod_1.z.string().optional(),
    }),
});
exports.journalEntriesQueryValidator = journalEntriesQueryValidator;
