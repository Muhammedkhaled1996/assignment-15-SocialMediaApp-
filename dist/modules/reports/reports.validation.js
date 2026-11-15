"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripProfitabilityQueryValidator = void 0;
const zod_1 = require("zod");
const tripProfitabilityQueryValidator = (_lang) => zod_1.z.object({
    query: zod_1.z.object({
        tripId: zod_1.z.string().optional(),
        season: zod_1.z.string().optional(),
    }),
});
exports.tripProfitabilityQueryValidator = tripProfitabilityQueryValidator;
