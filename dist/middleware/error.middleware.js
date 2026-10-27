"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandling = void 0;
const globalErrorHandling = (error, req, res, next) => {
    return res.status(error.status ?? 500).json({
        error_message: error.message || "Server Error",
        status: error.cause || 500,
        stack: error.stack,
    });
};
exports.globalErrorHandling = globalErrorHandling;
