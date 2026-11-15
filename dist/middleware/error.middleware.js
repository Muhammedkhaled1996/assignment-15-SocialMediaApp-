"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandling = void 0;
const config_1 = require("../config");
const globalErrorHandling = (error, req, res, next) => {
    let status = error.status ?? error.cause?.status ?? 500;
    let code = error.code || "INTERNAL_SERVER_ERROR";
    let message = error.message || "Server Error";
    let errors = Array.isArray(error.cause) ? error.cause : [];
    if (error.code === 11000 || error.cause?.code === 11000) {
        status = 409;
        code = "DUPLICATE_KEY_ERROR";
        const keyVal = error.keyValue || error.cause?.keyValue || {};
        message = `Duplicate value for field(s): ${Object.keys(keyVal).join(", ")}`;
        errors = [{ fields: keyVal }];
    }
    else if (error.name === "CastError") {
        status = 400;
        code = "INVALID_OBJECT_ID";
        message = `Invalid identifier format for ${error.path}: ${error.value}`;
    }
    else if (error.name === "ValidationError" && error.errors && !Array.isArray(error.cause)) {
        status = 400;
        code = "VALIDATION_ERROR";
        errors = Object.values(error.errors).map((e) => ({
            path: e.path,
            message: e.message,
        }));
    }
    else if (error.name === "TokenExpiredError") {
        status = 401;
        code = "TOKEN_EXPIRED";
        message = "Token has expired";
    }
    else if (error.name === "JsonWebTokenError") {
        status = 401;
        code = "INVALID_TOKEN";
        message = "Invalid authentication token";
    }
    else if (status === 400 && Array.isArray(error.cause)) {
        code = error.code === "BAD_REQUEST" ? "VALIDATION_ERROR" : error.code;
    }
    const responsePayload = {
        success: false,
        message,
        error_message: message,
        code: String(code),
        status,
        errors,
    };
    if (config_1.NODE_ENV !== "production") {
        responsePayload.stack = error.stack;
    }
    return res.status(typeof status === "number" ? status : 500).json(responsePayload);
};
exports.globalErrorHandling = globalErrorHandling;
