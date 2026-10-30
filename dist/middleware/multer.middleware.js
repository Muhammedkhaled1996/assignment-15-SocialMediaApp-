"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = void 0;
const exception_1 = require("../common/exception");
const multer_1 = require("../common/utils/multer");
const uploadMiddleware = ({ isRequired = true, multerMiddleware, customPath = "general", validation = [], }) => {
    return (req, res, next) => {
        multerMiddleware(req, res, async (error) => {
            if (error) {
                next(new Error(error.message, { cause: { status: 400 } }));
                return;
            }
            try {
                if (isRequired &&
                    !req.file &&
                    !(Array.isArray(req.files) && req.files.length) &&
                    !(typeof req.files == "object" && Object.keys(req.files)?.length)) {
                    next(new exception_1.BadRequestException("file is required"));
                    return;
                }
                await (0, multer_1.proccessMulterUpload)({ customPath, validation, req });
                next();
            }
            catch (error) {
                next(new Error(error.message, { cause: { status: 400 } }));
            }
        });
    };
};
exports.uploadMiddleware = uploadMiddleware;
