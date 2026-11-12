"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = void 0;
const exception_1 = require("../common/exception");
const cloud_multer_1 = require("../common/utils/multer/cloud.multer");
const local_multer_1 = require("../common/utils/multer/local.multer");
const attachment_enum_1 = require("../common/enum/attachment.enum");
const uploadMiddleware = ({ isRequired = true, multerMiddleware, customPath = "general", validation = [], storageApproach = attachment_enum_1.AttachmentEnum.local, }) => {
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
                if (storageApproach === attachment_enum_1.AttachmentEnum.cloud) {
                    await (0, cloud_multer_1.processMulterUpload)({ customPath, validation, req });
                }
                else {
                    await (0, local_multer_1.processMulterUpload)({ customPath, validation, req });
                }
                next();
            }
            catch (error) {
                next(new Error(error.message, { cause: { status: 400 } }));
            }
        });
    };
};
exports.uploadMiddleware = uploadMiddleware;
