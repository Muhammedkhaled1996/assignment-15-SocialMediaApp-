"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQueryValidator = void 0;
const zod_1 = require("zod");
const notificationQueryValidator = (_lang) => zod_1.z.object({
    query: zod_1.z.object({
        unreadOnly: zod_1.z.string().optional(),
        limit: zod_1.z.string().optional(),
    }),
});
exports.notificationQueryValidator = notificationQueryValidator;
