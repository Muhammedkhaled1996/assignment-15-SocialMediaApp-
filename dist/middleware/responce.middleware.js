"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.responceFormatter = void 0;
const responceFormatter = (handler) => {
    return async (req, res, next) => {
        const { status = 200, message = true, data = undefined, extra = undefined, } = (await handler(req, res, next)) || {};
        if (res.headersSent) {
            return;
        }
        return res.status(status).json({ message, status, data, extra });
    };
};
exports.responceFormatter = responceFormatter;
