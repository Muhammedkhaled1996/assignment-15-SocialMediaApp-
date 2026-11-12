"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMulterUpload = exports.processFields = exports.processFiles = exports.processFile = exports.cloudFileUpload = exports.fileValidation = void 0;
const multer_1 = __importDefault(require("multer"));
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const file_type_1 = require("file-type");
const exception_1 = require("../../exception");
const enum_1 = require("../../enum");
const node_os_1 = require("node:os");
const service_1 = require("../../service");
const config_1 = require("../../../config");
exports.fileValidation = {
    image: ["image/jpeg", "image/png", "image/gif"],
    files: ["application/pdf", "application/json"],
};
const cloudFileUpload = ({ maxFileSize = 5, storageApproach = enum_1.StorageApproach.MEMORY, }) => {
    const storage = storageApproach == enum_1.StorageApproach.MEMORY
        ? multer_1.default.memoryStorage()
        : multer_1.default.diskStorage({
            destination(req, file, callback) {
                callback(null, (0, node_os_1.tmpdir)());
            },
            filename(req, file, callback) {
                callback(null, (0, node_crypto_1.randomUUID)() + file.originalname);
            },
        });
    return (0, multer_1.default)({ storage, limits: { fileSize: maxFileSize * 1024 * 1024 } });
};
exports.cloudFileUpload = cloudFileUpload;
const processFile = async ({ customPath, file, validation = [], }) => {
    if (file.path) {
        file.buffer = await (0, promises_1.readFile)(file.path);
    }
    const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
    if (!result || !validation.includes(result.mime)) {
        if (file.path) {
            await (0, promises_1.unlink)(file.path);
        }
        throw new exception_1.BadRequestException("Invalid file formats");
    }
    const key = await service_1.cloudService.uploadAsset({ file, folder: customPath });
    if (file.path) {
        await (0, promises_1.unlink)(file.path);
    }
    file.path = `${config_1.ATTACHMENT_STORAGE_URL}${key}`;
    return file;
};
exports.processFile = processFile;
const processFiles = async ({ customPath, files = [], validation = [], }) => {
    const readyToUpload = [];
    for (const file of files) {
        if (file.path) {
            file.buffer = await (0, promises_1.readFile)(file.path);
        }
        const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
        if (!result || !validation.includes(result.mime)) {
            if (file.path) {
                await (0, promises_1.unlink)(file.path);
            }
            throw new exception_1.BadRequestException("Invalid file formats");
        }
        readyToUpload.push(file);
    }
    const assets = [];
    for (const file of readyToUpload) {
        const key = await service_1.cloudService.uploadAsset({ file, folder: customPath });
        if (file.path) {
            await (0, promises_1.unlink)(file.path);
        }
        file.path = `${config_1.ATTACHMENT_STORAGE_URL}${key}`;
        assets.push(file);
    }
    return assets;
};
exports.processFiles = processFiles;
const processFields = async ({ customPath, fields = {}, validation = [], }) => {
    const readyToUpload = [];
    for (const fieldName of Object.keys(fields)) {
        const fileList = Array.isArray(fields[fieldName]) ? fields[fieldName] : [fields[fieldName]];
        for (const file of fileList) {
            if (file.path) {
                file.buffer = await (0, promises_1.readFile)(file.path);
            }
            const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
            if (!result || !validation.includes(result.mime)) {
                if (file.path) {
                    await (0, promises_1.unlink)(file.path);
                }
                throw new exception_1.BadRequestException("Invalid file formats");
            }
            readyToUpload.push(file);
        }
    }
    const assets = [];
    for (const file of readyToUpload) {
        const key = await service_1.cloudService.uploadAsset({ file, folder: customPath });
        if (file?.path) {
            await (0, promises_1.unlink)(file.path);
        }
        file.path = `${config_1.ATTACHMENT_STORAGE_URL}${key}`;
        assets.push(file);
    }
    return assets;
};
exports.processFields = processFields;
const processMulterUpload = async ({ req, customPath = "general", validation = [], }) => {
    if (req.file) {
        await (0, exports.processFile)({ customPath, file: req.file, validation });
    }
    else if (Array.isArray(req.files)) {
        await (0, exports.processFiles)({ customPath, files: req.files, validation });
    }
    else if (typeof req.files == "object" && Object.keys(req.files).length) {
        await (0, exports.processFields)({ customPath, fields: req.files, validation });
    }
};
exports.processMulterUpload = processMulterUpload;
