"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsController = void 0;
const express_1 = require("express");
const middleware_1 = require("../../middleware");
const multer_1 = require("../../common/utils/multer");
const enum_1 = require("../../common/enum");
const config_1 = require("../../config");
const settings_service_1 = require("./settings.service");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/company", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...enum_1.ALL_USER_ROLES), (0, middleware_1.responceFormatter)(async (_req) => {
    const data = await settings_service_1.settingsService.getCompanyProfile();
    return { data };
}));
router.patch("/company", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await settings_service_1.settingsService.updateCompanyProfile(req.body, req);
    return { data };
}));
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...enum_1.ALL_USER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await settings_service_1.settingsService.listSettings(req.query);
    return { data };
}));
router.put("/:key", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await settings_service_1.settingsService.upsertSetting(req.params.key, req.body, req);
    return { data };
}));
router.post("/attachments", (0, middleware_1.authentication)(), (0, middleware_1.uploadMiddleware)({
    isRequired: true,
    multerMiddleware: (0, multer_1.localFileUpload)({ maxFileSize: 10, storageApproach: enum_1.StorageApproach.MEMORY }).single("file"),
    customPath: "attachments",
    validation: [...multer_1.fileValidation.image, ...multer_1.fileValidation.files],
    storageApproach: config_1.FILE_STORAGE_PROVIDER === "S3" ? enum_1.AttachmentEnum.cloud : enum_1.AttachmentEnum.local,
}), (0, middleware_1.responceFormatter)(async (req) => {
    const file = req.file;
    const data = await settings_service_1.settingsService.createAttachment(file, req);
    return { status: 201, data };
}));
router.get("/attachments", (0, middleware_1.authentication)(), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await settings_service_1.settingsService.listAttachments(req);
    return { data };
}));
exports.settingsController = router;
exports.default = router;
