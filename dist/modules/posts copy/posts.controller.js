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
const posts_services_1 = require("./posts.services");
const responce_middleware_1 = require("../../middleware/responce.middleware");
const multer_middleware_1 = require("../../middleware/multer.middleware");
const validation_middleware_1 = require("../../middleware/validation.middleware");
const validators = __importStar(require("./posts.validation"));
const multer_1 = require("../../common/utils/multer");
const enum_1 = require("../../common/enum");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await posts_services_1.postService.getPosts();
    return { data };
}));
router.get("/login-user-posts", (0, authentication_middleware_1.authentication)(), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await posts_services_1.postService.getUserPosts(req.user._id);
    return { data };
}));
router.get("/get-user-post/:postId", (0, authentication_middleware_1.authentication)(), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await posts_services_1.postService.getSinglePost(req.params.postId);
    return { data };
}));
router.post("/", async (req, res, next) => {
    if (req.headers["authorization"]) {
        await (0, authentication_middleware_1.bearerAuth)({ req });
    }
    next();
}, (0, multer_middleware_1.uploadMiddleware)({
    multerMiddleware: (0, multer_1.localFileUpload)({ maxFileSize: 5, storageApproach: enum_1.StorageApproach.DISK }).array("images"),
    validation: multer_1.fileValidation.image,
    customPath: "posts",
    isRequired: false,
}), (0, validation_middleware_1.validation)(validators.createPost), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await posts_services_1.postService.createPost(req.body, req.files, req.user);
    return { data, status: 201 };
}));
router.patch("/:postId", async (req, res, next) => {
    if (req.headers["authorization"]) {
        await (0, authentication_middleware_1.bearerAuth)({ req });
    }
    next();
}, (0, multer_middleware_1.uploadMiddleware)({
    multerMiddleware: (0, multer_1.localFileUpload)({ maxFileSize: 5, storageApproach: enum_1.StorageApproach.DISK }).array("images"),
    validation: multer_1.fileValidation.image,
    customPath: "posts",
    isRequired: false,
}), (0, validation_middleware_1.validation)(validators.createPost), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await posts_services_1.postService.updatePost(req.body, req.files, req.user, req.params.postId);
    return { data };
}));
router.delete("/:postId", (0, authentication_middleware_1.authentication)(), (0, responce_middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await posts_services_1.postService.deletePost(req.user, req.params.postId);
    return { data };
}));
exports.default = router;
