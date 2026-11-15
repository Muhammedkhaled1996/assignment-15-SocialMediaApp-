"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidStateTransitionError = exports.AccountingIntegrityError = exports.InsufficientBalanceError = exports.InsufficientInventoryError = exports.TooManyRequestException = exports.ConflictError = exports.ConflictException = exports.AuthorizationError = exports.ForbiddenException = exports.AuthenticationError = exports.UnauthorizedException = exports.NotFoundError = exports.NotFoundException = exports.ValidationError = exports.BadRequestException = void 0;
const application_exception_1 = require("./application.exception");
class BadRequestException extends application_exception_1.ApplicationException {
    constructor(message = "BadRequest", cause, code = "BAD_REQUEST") {
        super(message, 400, cause, code);
    }
}
exports.BadRequestException = BadRequestException;
class ValidationError extends BadRequestException {
    constructor(message = "Validation failed", cause) {
        super(message, cause, "VALIDATION_ERROR");
    }
}
exports.ValidationError = ValidationError;
class NotFoundException extends application_exception_1.ApplicationException {
    constructor(message = "NotFoundException", cause, code = "NOT_FOUND") {
        super(message, 404, cause, code);
    }
}
exports.NotFoundException = NotFoundException;
exports.NotFoundError = NotFoundException;
class UnauthorizedException extends application_exception_1.ApplicationException {
    constructor(message = "UnauthorizedException", cause, code = "AUTHENTICATION_ERROR") {
        super(message, 401, cause, code);
    }
}
exports.UnauthorizedException = UnauthorizedException;
exports.AuthenticationError = UnauthorizedException;
class ForbiddenException extends application_exception_1.ApplicationException {
    constructor(message = "ForbiddenException", cause, code = "AUTHORIZATION_ERROR") {
        super(message, 403, cause, code);
    }
}
exports.ForbiddenException = ForbiddenException;
exports.AuthorizationError = ForbiddenException;
class ConflictException extends application_exception_1.ApplicationException {
    constructor(message = "ConflictException", cause, code = "CONFLICT_ERROR") {
        super(message, 409, cause, code);
    }
}
exports.ConflictException = ConflictException;
exports.ConflictError = ConflictException;
class TooManyRequestException extends application_exception_1.ApplicationException {
    constructor(message = "TooManyRequestException", cause, code = "RATE_LIMIT_EXCEEDED") {
        super(message, 429, cause, code);
    }
}
exports.TooManyRequestException = TooManyRequestException;
class InsufficientInventoryError extends application_exception_1.ApplicationException {
    constructor(message = "Insufficient seat or room inventory", cause) {
        super(message, 409, cause, "INSUFFICIENT_INVENTORY");
    }
}
exports.InsufficientInventoryError = InsufficientInventoryError;
class InsufficientBalanceError extends application_exception_1.ApplicationException {
    constructor(message = "Insufficient balance for this operation", cause) {
        super(message, 422, cause, "INSUFFICIENT_BALANCE");
    }
}
exports.InsufficientBalanceError = InsufficientBalanceError;
class AccountingIntegrityError extends application_exception_1.ApplicationException {
    constructor(message = "Accounting integrity violation: Debits must equal Credits", cause) {
        super(message, 422, cause, "ACCOUNTING_INTEGRITY_ERROR");
    }
}
exports.AccountingIntegrityError = AccountingIntegrityError;
class InvalidStateTransitionError extends application_exception_1.ApplicationException {
    constructor(message = "Invalid state transition", cause) {
        super(message, 422, cause, "INVALID_STATE_TRANSITION");
    }
}
exports.InvalidStateTransitionError = InvalidStateTransitionError;
