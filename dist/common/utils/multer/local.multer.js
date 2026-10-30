"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proccessMulterUpload = exports.proccessFields = exports.proccessFiles = exports.proccessFile = exports.localFileUpload = exports.filePath = exports.fileValidation = void 0;
const multer_1 = __importDefault(require("multer"));
const node_crypto_1 = require("node:crypto");
const node_path_1 = require("node:path");
const promises_1 = require("node:fs/promises");
const file_type_1 = require("file-type");
const exception_1 = require("../../exception");
exports.fileValidation = {
    image: ["image/jpeg", "image/png", "image/gif"],
    files: ["application/pdf", "application/json"],
};
const filePath = async ({ customPath, result = {} }) => {
    await (0, promises_1.mkdir)((0, node_path_1.resolve)(`./assets/${customPath}`), { recursive: true });
    const uniquefilePath = `assets/${customPath}/${(0, node_crypto_1.randomUUID)()}.${result.ext}`;
    return uniquefilePath;
};
exports.filePath = filePath;
const localFileUpload = ({ maxFileSize = 5 } = {}) => {
    const storage = multer_1.default.memoryStorage();
    return (0, multer_1.default)({ storage, limits: { fileSize: maxFileSize * 1024 * 1024 } });
};
exports.localFileUpload = localFileUpload;
const proccessFile = async ({ customPath, file, validation = [], }) => {
    const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
    if (!result || !validation.includes(result.mime)) {
        throw new exception_1.BadRequestException("Invalid file formats");
    }
    const uniquefilePath = await (0, exports.filePath)({ customPath, result });
    await (0, promises_1.writeFile)((0, node_path_1.resolve)(`./${uniquefilePath}`), file.buffer);
    file.path = uniquefilePath;
    return file;
};
exports.proccessFile = proccessFile;
const proccessFiles = async ({ customPath, files = [], validation = [], }) => {
    const readyToSave = [];
    for (const file of files) {
        const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
        if (!result || !validation.includes(result.mime)) {
            throw new exception_1.BadRequestException("Invalid file formats");
        }
        const uniquefilePath = await (0, exports.filePath)({ customPath, result });
        readyToSave.push({ file, path: uniquefilePath });
    }
    const assets = [];
    for (const { file, path } of readyToSave) {
        await (0, promises_1.writeFile)((0, node_path_1.resolve)(`./${path}`), file.buffer);
        file.path = path;
        assets.push(file);
    }
    return assets;
};
exports.proccessFiles = proccessFiles;
const proccessFields = async ({ customPath, fields = {}, validation = [], }) => {
    const readyToSave = [];
    for (const fieldName of Object.keys(fields)) {
        const fileList = Array.isArray(fields[fieldName]) ? fields[fieldName] : [fields[fieldName]];
        for (const file of fileList) {
            const result = await (0, file_type_1.fileTypeFromBuffer)(file.buffer);
            if (!result || !validation.includes(result.mime)) {
                throw new exception_1.BadRequestException("Invalid file formats");
            }
            const uniquefilePath = await (0, exports.filePath)({ customPath, result });
            readyToSave.push({ file, path: uniquefilePath });
        }
    }
    const assets = [];
    for (const { file, path } of readyToSave) {
        await (0, promises_1.writeFile)((0, node_path_1.resolve)(`./${path}`), file.buffer);
        file.path = path;
        assets.push(file);
    }
    return assets;
};
exports.proccessFields = proccessFields;
const proccessMulterUpload = async ({ req, customPath = "general", validation = [], }) => {
    if (req.file) {
        await (0, exports.proccessFile)({ customPath, file: req.file, validation });
    }
    else if (Array.isArray(req.files)) {
        await (0, exports.proccessFiles)({ customPath, files: req.files, validation });
    }
    else if (typeof req.files == "object" && Object.keys(req.files).length) {
        await (0, exports.proccessFields)({ customPath, fields: req.files, validation });
    }
};
exports.proccessMulterUpload = proccessMulterUpload;
