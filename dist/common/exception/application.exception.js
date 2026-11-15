"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationException = void 0;
class ApplicationException extends Error {
    message;
    status;
    cause;
    code;
    constructor(message, status, cause, code) {
        super();
        this.message = message;
        this.status = status;
        this.cause = cause;
        this.name = this.constructor.name;
        this.code = code || this.name.replace(/Exception|Error$/, "").toUpperCase() || "APPLICATION_ERROR";
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApplicationException = ApplicationException;
