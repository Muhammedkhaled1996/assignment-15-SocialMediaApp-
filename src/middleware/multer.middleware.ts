import { NextFunction, Request, RequestHandler, Response } from "express";
import { BadRequestException } from "../common/exception";
import { processMulterUpload as cloudprocessMulterUpload } from "../common/utils/multer/cloud.multer";
import { processMulterUpload as localprocessMulterUpload } from "../common/utils/multer/local.multer";
import { AttachmentEnum } from "../common/enum/attachment.enum";

export const uploadMiddleware = ({
  isRequired = true,
  multerMiddleware,
  customPath = "general",
  validation = [],
  storageApproach = AttachmentEnum.local,
}: {
  isRequired: boolean;
  multerMiddleware: RequestHandler;
  customPath: string;
  validation: string[];
  storageApproach: AttachmentEnum;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, async (error: any) => {
      if (error) {
        next(new Error(error.message, { cause: { status: 400 } }));
        return;
      }

      try {
        if (
          isRequired &&
          !req.file &&
          !(Array.isArray(req.files) && req.files.length) &&
          !(typeof req.files == "object" && Object.keys(req.files)?.length)
        ) {
          next(new BadRequestException("file is required"));
          return;
        }

        if (storageApproach === AttachmentEnum.cloud) {
          await cloudprocessMulterUpload({ customPath, validation, req });
        } else {
          await localprocessMulterUpload({ customPath, validation, req });
        }

        next();
      } catch (error: any) {
        next(new Error(error.message, { cause: { status: 400 } }));
      }
    });
  };
};
