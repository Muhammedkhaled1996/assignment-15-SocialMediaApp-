import type { NextFunction, Request, Response } from "express";
import { IError } from "../common/interface";
import { NODE_ENV } from "../config";

// Fixed error structure with production-safe redaction and standard error codes
export const globalErrorHandling = (error: any, req: Request, res: Response, next: NextFunction) => {
  let status = error.status ?? (error.cause as any)?.status ?? 500;
  let code = error.code || "INTERNAL_SERVER_ERROR";
  let message = error.message || "Server Error";
  let errors: any[] = Array.isArray(error.cause) ? error.cause : [];

  // Handle MongoDB Duplicate Key Error (11000)
  if (error.code === 11000 || error.cause?.code === 11000) {
    status = 409;
    code = "DUPLICATE_KEY_ERROR";
    const keyVal = error.keyValue || error.cause?.keyValue || {};
    message = `Duplicate value for field(s): ${Object.keys(keyVal).join(", ")}`;
    errors = [{ fields: keyVal }];
  } else if (error.name === "CastError") {
    status = 400;
    code = "INVALID_OBJECT_ID";
    message = `Invalid identifier format for ${error.path}: ${error.value}`;
  } else if (error.name === "ValidationError" && error.errors && !Array.isArray(error.cause)) {
    status = 400;
    code = "VALIDATION_ERROR";
    errors = Object.values(error.errors).map((e: any) => ({
      path: e.path,
      message: e.message,
    }));
  } else if (error.name === "TokenExpiredError") {
    status = 401;
    code = "TOKEN_EXPIRED";
    message = "Token has expired";
  } else if (error.name === "JsonWebTokenError") {
    status = 401;
    code = "INVALID_TOKEN";
    message = "Invalid authentication token";
  } else if (status === 400 && Array.isArray(error.cause)) {
    code = error.code === "BAD_REQUEST" ? "VALIDATION_ERROR" : error.code;
  }

  const responsePayload: Record<string, any> = {
    success: false,
    message,
    error_message: message,
    code: String(code),
    status,
    errors,
  };

  if (NODE_ENV !== "production") {
    responsePayload.stack = error.stack;
  }

  return res.status(typeof status === "number" ? status : 500).json(responsePayload);
};

