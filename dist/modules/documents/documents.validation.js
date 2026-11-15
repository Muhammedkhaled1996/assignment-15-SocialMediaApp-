"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptDocumentParamValidator = exports.tripDocumentParamValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const tripDocumentParamValidator = (lang) => zod_1.z.object({
    params: zod_1.z.object({ tripId: utils_1.generalValidationFields.id(lang) }),
});
exports.tripDocumentParamValidator = tripDocumentParamValidator;
const receiptDocumentParamValidator = (lang) => zod_1.z.object({
    params: zod_1.z.object({ receiptId: utils_1.generalValidationFields.id(lang) }),
});
exports.receiptDocumentParamValidator = receiptDocumentParamValidator;
