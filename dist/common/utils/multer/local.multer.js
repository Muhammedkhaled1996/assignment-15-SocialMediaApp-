"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMulterUpload = exports.processFields = exports.processFiles = exports.processFile = exports.localFileUpload = exports.filePath = exports.fileValidation = void 0;
const multer_1 = __importDefault(require("multer"));
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
const promises_1 = require("node:fs/promises");
const file_type_1 = require("file-type");
const exception_1 = require("../../exception");
const enum_1 = require("../../enum");
const node_os_1 = require("node:os");
exports.fileValidation = {
    image: ["image/jpeg", "image/png", "image/gif"],
    files: ["application/pdf", "application/json"],
};
const filePath = async ({ customPath, result = {} }) => {
    await (0, promises_1.mkdir)((0, node_path_1.resolve)(`./assets/${customPath}`), { recursive: true });
    const uniqueFilePath = `assets/${customPath}/${(0, node_crypto_1.randomUUID)()}.${result.ext}`;
    return uniqueFilePath;
};
exports.filePath = filePath;
const localFileUpload = ({ maxFileSize = 5, storageApproach = enum_1.StorageApproach.MEMORY, }) => {
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
exports.localFileUpload = localFileUpload;
const processFile = async ({ customPath, file, validation = [], }) => {
    if (file.path) {
        file.buffer = await (0, promises_1.readFile)(file.path);
    }
    const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
    if (!result || !validation.includes(result.mime)) {
        await (0, promises_1.unlink)(file.path);
        throw new exception_1.BadRequestException("Invalid file formats");
    }
    const uniquefilePath = await (0, exports.filePath)({ customPath, result });
    await (0, promises_1.writeFile)((0, node_path_1.resolve)(`./${uniquefilePath}`), file.buffer);
    if (file.path) {
        await (0, promises_1.unlink)(file.path);
    }
    file.path = uniquefilePath;
    return file;
};
exports.processFile = processFile;
const processFiles = async ({ customPath, files = [], validation = [], }) => {
    const readyToSave = [];
    for (const file of files) {
        if (file.path) {
            file.buffer = await (0, promises_1.readFile)(file.path);
        }
        const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
        if (!result || !validation.includes(result.mime)) {
            await (0, promises_1.unlink)(file.path);
            throw new exception_1.BadRequestException("Invalid file formats");
        }
        const uniquefilePath = await (0, exports.filePath)({ customPath, result });
        readyToSave.push({ file, path: uniquefilePath });
    }
    const assets = [];
    for (const { file, path } of readyToSave) {
        await (0, promises_1.writeFile)((0, node_path_1.resolve)(`./${path}`), file.buffer);
        if (file.path) {
            await (0, promises_1.unlink)(file.path);
        }
        file.path = path;
        assets.push(file);
    }
    return assets;
};
exports.processFiles = processFiles;
const processFields = async ({ customPath, fields = {}, validation = [], }) => {
    const readyToSave = [];
    for (const fieldName of Object.keys(fields)) {
        const fileList = Array.isArray(fields[fieldName]) ? fields[fieldName] : [fields[fieldName]];
        for (const file of fileList) {
            if (file.path) {
                file.buffer = await (0, promises_1.readFile)(file.path);
            }
            const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
            if (!result || !validation.includes(result.mime)) {
                await (0, promises_1.unlink)(file.path);
                throw new exception_1.BadRequestException("Invalid file formats");
            }
            const uniquefilePath = await (0, exports.filePath)({ customPath, result });
            readyToSave.push({ file, path: uniquefilePath });
        }
    }
    const assets = [];
    for (const { file, path } of readyToSave) {
        await (0, promises_1.writeFile)((0, node_path_1.resolve)(`./${path}`), file.buffer);
        if (file?.path) {
            await (0, promises_1.unlink)(file.path);
        }
        file.path = path;
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
