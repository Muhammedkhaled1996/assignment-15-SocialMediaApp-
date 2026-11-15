import { NextFunction, Request, Response } from "express";
import { IResponse } from "../common/interface";

export function sanitizeSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date || typeof obj !== "object") return obj;
  if (obj._bsontype === "ObjectId" || typeof obj.toHexString === "function") {
    return obj.toString();
  }
  if (Buffer.isBuffer(obj)) return obj;
  if (typeof obj.toObject === "function") {
    obj = obj.toObject({ virtuals: true });
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeSensitiveData);
  }
  const clone: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "password" || k === "confirmPassword" || k === "tokenHash" || k === "refreshTokenHash") {
      continue;
    }
    clone[k] = sanitizeSensitiveData(v);
  }
  return clone;
}

export const responceFormatter = (handler: Function) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const result: IResponse = (await handler(req, res, next)) || {};
      const {
        status = 200,
        message = "Operation completed",
        data = undefined,
        meta = undefined,
      } = result;

      if (res.headersSent) {
        return;
      }

      const sanitizedData = sanitizeSensitiveData(data);
      const resolvedMeta =
        meta !== undefined
          ? meta
          : sanitizedData && typeof sanitizedData === "object" && "pagination" in sanitizedData
            ? { totalDocs: sanitizedData.totalDocs, ...sanitizedData.pagination }
            : {};

      return res.status(status).json({
        success: true,
        message: typeof message === "string" ? message : "Operation completed",
        status,
        data: sanitizedData,
        meta: resolvedMeta,
      });
    } catch (error) {
      next(error);
    }
  };
};
