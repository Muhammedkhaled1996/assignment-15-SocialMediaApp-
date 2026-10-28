"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validation = void 0;
const enum_1 = require("../common/enum");
const domain_exception_js_1 = require("../common/exception/domain.exception.js");
const validation = (schema) => {
    return (req, res, next) => {
        const lang = Number(req.headers["accept-language"] ?? enum_1.LanguageEnum.EN);
        const validationResult = schema(lang).safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
            headers: req.headers,
            files: req.files,
            file: req.file,
        });
        if (!validationResult.success) {
            throw new domain_exception_js_1.BadRequestException("Validation error", validationResult.error.issues);
        }
        req.validate = validationResult.data;
        next();
    };
};
exports.validation = validation;
