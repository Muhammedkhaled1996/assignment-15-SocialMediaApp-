import multer from "multer";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { fileTypeFromBuffer } from "file-type";
import { BadRequestException } from "../../exception";
import { Request } from "express";
import { StorageApproach } from "../../enum";
import { tmpdir } from "node:os";
import { cloudService } from "../../service";
import { ATTACHMENT_STORAGE_URL } from "../../../config";

export const fileValidation = {
  image: ["image/jpeg", "image/png", "image/gif"],
  files: ["application/pdf", "application/json"],
};

export const cloudFileUpload = ({
  maxFileSize = 5,
  storageApproach = StorageApproach.MEMORY,
}: {
  maxFileSize: number;
  storageApproach?: StorageApproach;
}) => {
  const storage =
    storageApproach == StorageApproach.MEMORY
      ? multer.memoryStorage()
      : multer.diskStorage({
          destination(req, file, callback) {
            callback(null, tmpdir());
          },
          filename(req, file, callback) {
            callback(null, randomUUID() + file.originalname);
          },
        });

  return multer({ storage, limits: { fileSize: maxFileSize * 1024 * 1024 } });
};

export const processFile = async ({
  customPath,
  file,
  validation = [],
}: {
  customPath: string;
  file: Express.Multer.File;
  validation: string[];
}) => {
  if (file.path) {
    file.buffer = await readFile(file.path);
  }

  const result = await fileTypeFromBuffer(file.buffer);
  if (!result || !validation.includes(result.mime)) {
    if (file.path) {
      await unlink(file.path);
    }
    throw new BadRequestException("Invalid file formats");
  }

  const key = await cloudService.uploadAsset({ file, folder: customPath });
  if (file.path) {
    await unlink(file.path);
  }
  file.path = `${ATTACHMENT_STORAGE_URL}${key}`;
  return file;
};

export const processFiles = async ({
  customPath,
  files = [],
  validation = [],
}: {
  customPath: string;
  files: Express.Multer.File[];
  validation: string[];
}) => {
  const readyToUpload: Express.Multer.File[] = [];

  for (const file of files) {
    if (file.path) {
      file.buffer = await readFile(file.path);
    }
    const result = await fileTypeFromBuffer(file.buffer);
    if (!result || !validation.includes(result.mime)) {
      if (file.path) {
        await unlink(file.path);
      }
      throw new BadRequestException("Invalid file formats");
    }

    readyToUpload.push(file);
  }

  const assets = [];

  for (const file of readyToUpload) {
    const key = await cloudService.uploadAsset({ file, folder: customPath });
    if (file.path) {
      await unlink(file.path);
    }
    file.path = `${ATTACHMENT_STORAGE_URL}${key}`;
    assets.push(file);
  }

  return assets;
};

export const processFields = async ({
  customPath,
  fields = {},
  validation = [],
}: {
  customPath: string;
  fields: Record<string, Express.Multer.File[]>;
  validation: string[];
}) => {
  const readyToUpload: Express.Multer.File[] = [];

  for (const fieldName of Object.keys(fields)) {
    const fileList = Array.isArray(fields[fieldName]) ? fields[fieldName] : [fields[fieldName]];

    for (const file of fileList) {
      if (file!.path) {
        file!.buffer = await readFile(file!.path);
      }
      const result = await fileTypeFromBuffer(file!.buffer);

      if (!result || !validation.includes(result.mime)) {
        if (file!.path) {
          await unlink(file!.path);
        }
        throw new BadRequestException("Invalid file formats");
      }

      readyToUpload.push(file!);
    }
  }

  const assets = [];

  for (const file of readyToUpload) {
    const key = await cloudService.uploadAsset({ file, folder: customPath });
    if (file?.path) {
      await unlink(file.path);
    }
    file.path = `${ATTACHMENT_STORAGE_URL}${key}`;
    assets.push(file);
  }

  return assets;
};

export const processMulterUpload = async ({
  req,
  customPath = "general",
  validation = [],
}: {
  req: Request;
  customPath: string;
  validation: string[];
}) => {
  if (req.file) {
    await processFile({ customPath, file: req.file, validation });
  } else if (Array.isArray(req.files)) {
    await processFiles({ customPath, files: req.files, validation });
  } else if (typeof req.files == "object" && Object.keys(req.files).length) {
    await processFields({ customPath, fields: req.files, validation });
  }
};
