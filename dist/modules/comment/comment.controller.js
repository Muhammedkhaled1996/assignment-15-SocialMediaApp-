"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authentication_middleware_1 = require("../../middleware/authentication.middleware");
const responce_middleware_1 = require("../../middleware/responce.middleware");
const multer_middleware_1 = require("../../middleware/multer.middleware");
const validation_middleware_1 = require("../../middleware/validation.middleware");
const multer_1 = require("../../common/utils/multer");
const enum_1 = require("../../common/enum");
const comment_services_1 = require("./comment.services");
const validators = __importStar(require("./comment.validation"));
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/:commentId", (0, authentication_middleware_1.authentication)(), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await comment_services_1.commentService.getSingleComment(req.params.commentId);
    return { data };
}));
router.get("/post-comments/:postId", (0, authentication_middleware_1.authentication)(), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await comment_services_1.commentService.getPostComments(req.params.postId);
    return { data };
}));
router.post("/:postId", (0, authentication_middleware_1.authentication)(), (0, multer_middleware_1.uploadMiddleware)({
    multerMiddleware: (0, multer_1.localFileUpload)({ maxFileSize: 5, storageApproach: enum_1.StorageApproach.DISK }).array("images"),
    validation: multer_1.fileValidation.image,
    customPath: "comments",
    isRequired: false,
}), (0, validation_middleware_1.validation)(validators.createComment), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await comment_services_1.commentService.createComment(req.body, req.params.postId, req.files, req.user);
    return { data, status: 201 };
}));
router.patch("/:commentId", (0, authentication_middleware_1.authentication)(), (0, multer_middleware_1.uploadMiddleware)({
    multerMiddleware: (0, multer_1.localFileUpload)({ maxFileSize: 5, storageApproach: enum_1.StorageApproach.DISK }).array("images"),
    validation: multer_1.fileValidation.image,
    customPath: "comments",
    isRequired: false,
}), (0, validation_middleware_1.validation)(validators.updateComment), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await comment_services_1.commentService.updateComment(req.body, req.files, req.user, req.params.commentId);
    return { data };
}));
router.delete("/:commentId", (0, authentication_middleware_1.authentication)(), (0, validation_middleware_1.validation)(validators.deleteComment), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await comment_services_1.commentService.deleteComment(req.params.commentId, req.user);
    return { data };
}));
exports.default = router;
