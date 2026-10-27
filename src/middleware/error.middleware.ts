import type { NextFunction, Request, Response } from "express";
import { IError } from "../common/interface";

//Fixed  error  structure
export const globalErrorHandling = (error: IError, req: Request, res: Response, next: NextFunction) => {
  return res.status(error.status ?? 500).json({
    error_message: error.message || "Server Error",
    status: error.cause || 500,
    stack: error.stack,
  });
};
