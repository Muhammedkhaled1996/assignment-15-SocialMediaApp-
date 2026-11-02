import multer from "multer";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { fileTypeFromBuffer } from "file-type";
import { BadRequestException } from "../../exception";
import { Request } from "express";
import { StorageApproach } from "../../enum";
import { tmpdir } from "node:os";

export const fileValidation = {
  image: ["image/jpeg", "image/png", "image/gif"],
  files: ["application/pdf", "application/json"],
};

export const filePath = async ({ customPath, result = {} }: { customPath: string; result: any }) => {
  await mkdir(resolve(`./assets/${customPath}`), { recursive: true });
  const uniqueFilePath = `assets/${customPath}/${randomUUID()}.${result.ext}`;
  return uniqueFilePath;
};

export const localFileUpload = ({
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
    await unlink(file.path);
    throw new BadRequestException("Invalid file formats");
  }
  const uniquefilePath = await filePath({ customPath, result });
  await writeFile(resolve(`./${uniquefilePath}`), file.buffer);
  if (file.path) {
    await unlink(file.path);
  }
  file.path = uniquefilePath;
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
  const readyToSave = [];

  for (const file of files) {
    if (file.path) {
      file.buffer = await readFile(file.path);
    }
    const result = await fileTypeFromBuffer(file.buffer);
    if (!result || !validation.includes(result.mime)) {
      await unlink(file.path);
      throw new BadRequestException("Invalid file formats");
    }

    const uniquefilePath = await filePath({ customPath, result });
    readyToSave.push({ file, path: uniquefilePath });
  }

  const assets = [];

  for (const { file, path } of readyToSave) {
    await writeFile(resolve(`./${path}`), file.buffer);
    if (file.path) {
      await unlink(file.path);
    }
    file.path = path;
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
  const readyToSave = [];

  for (const fieldName of Object.keys(fields)) {
    const fileList = Array.isArray(fields[fieldName]) ? fields[fieldName] : [fields[fieldName]];

    for (const file of fileList) {
      if (file!.path) {
        file!.buffer = await readFile(file!.path);
      }
      const result = await fileTypeFromBuffer(file!.buffer);

      if (!result || !validation.includes(result.mime)) {
        await unlink(file!.path);
        throw new BadRequestException("Invalid file formats");
      }

      const uniquefilePath = await filePath({ customPath, result });
      readyToSave.push({ file, path: uniquefilePath });
    }
  }

  const assets = [];

  for (const { file, path } of readyToSave) {
    await writeFile(resolve(`./${path}`), file!.buffer);
    if (file?.path) {
      await unlink(file.path);
    }
    file!.path = path;
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
