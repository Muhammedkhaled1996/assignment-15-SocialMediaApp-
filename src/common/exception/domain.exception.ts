import { ApplicationException } from "./application.exception";

export class BadRequestException extends ApplicationException {
  constructor(message: string = "BadRequest", cause?: unknown, code: string = "BAD_REQUEST") {
    super(message, 400, cause, code);
  }
}

export class ValidationError extends BadRequestException {
  constructor(message: string = "Validation failed", cause?: unknown) {
    super(message, cause, "VALIDATION_ERROR");
  }
}

export class NotFoundException extends ApplicationException {
  constructor(message: string = "NotFoundException", cause?: unknown, code: string = "NOT_FOUND") {
    super(message, 404, cause, code);
  }
}
export const NotFoundError = NotFoundException;

export class UnauthorizedException extends ApplicationException {
  constructor(message: string = "UnauthorizedException", cause?: unknown, code: string = "AUTHENTICATION_ERROR") {
    super(message, 401, cause, code);
  }
}
export const AuthenticationError = UnauthorizedException;

export class ForbiddenException extends ApplicationException {
  constructor(message: string = "ForbiddenException", cause?: unknown, code: string = "AUTHORIZATION_ERROR") {
    super(message, 403, cause, code);
  }
}
export const AuthorizationError = ForbiddenException;

export class ConflictException extends ApplicationException {
  constructor(message: string = "ConflictException", cause?: unknown, code: string = "CONFLICT_ERROR") {
    super(message, 409, cause, code);
  }
}
export const ConflictError = ConflictException;

export class TooManyRequestException extends ApplicationException {
  constructor(message: string = "TooManyRequestException", cause?: unknown, code: string = "RATE_LIMIT_EXCEEDED") {
    super(message, 429, cause, code);
  }
}

export class InsufficientInventoryError extends ApplicationException {
  constructor(message: string = "Insufficient seat or room inventory", cause?: unknown) {
    super(message, 409, cause, "INSUFFICIENT_INVENTORY");
  }
}

export class InsufficientBalanceError extends ApplicationException {
  constructor(message: string = "Insufficient balance for this operation", cause?: unknown) {
    super(message, 422, cause, "INSUFFICIENT_BALANCE");
  }
}

export class AccountingIntegrityError extends ApplicationException {
  constructor(message: string = "Accounting integrity violation: Debits must equal Credits", cause?: unknown) {
    super(message, 422, cause, "ACCOUNTING_INTEGRITY_ERROR");
  }
}

export class InvalidStateTransitionError extends ApplicationException {
  constructor(message: string = "Invalid state transition", cause?: unknown) {
    super(message, 422, cause, "INVALID_STATE_TRANSITION");
  }
}

