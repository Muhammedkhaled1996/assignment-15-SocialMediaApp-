import { NextFunction, Request, Response } from "express";
import { LanguageEnum } from "../common/enum";
import { BadRequestException } from "../common/exception/domain.exception.js";
import { ZodType } from "zod";

type ValidationSchemaType = (lang: LanguageEnum) => ZodType;

export const validation = (schema: ValidationSchemaType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const lang = Number(req.headers["accept-language"] ?? LanguageEnum.EN);

    const validationResult = schema(lang).safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
      files: req.files,
      file: req.file,
    });

    if (!validationResult.success) {
      throw new BadRequestException("Validation error", validationResult.error.issues);
    }

    req.validate = validationResult.data;

    next();
  };
};
