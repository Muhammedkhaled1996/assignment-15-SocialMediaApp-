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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authentication_middleware_js_1 = require("../../middleware/authentication.middleware.js");
const users_services_1 = __importDefault(require("./users.services"));
const responce_middleware_js_1 = require("../../middleware/responce.middleware.js");
const multer_middleware_js_1 = require("../../middleware/multer.middleware.js");
const local_multer_js_1 = require("../../common/utils/multer/local.multer.js");
const user_repository_js_1 = require("../../common/repository/user.repository.js");
const validation_middleware_js_1 = require("../../middleware/validation.middleware.js");
const validator = __importStar(require("./user.validation.js"));
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, authentication_middleware_js_1.authentication)(), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    const data = await users_services_1.default.Profile(req.user);
    return { data };
}));
router.patch("/", (0, authentication_middleware_js_1.authentication)(), (0, validation_middleware_js_1.validation)(validator.update), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    const data = await users_services_1.default.update(req.user, req.validate.body);
    return { data };
}));
router.patch("/profile-image", (0, authentication_middleware_js_1.authentication)(), (0, multer_middleware_js_1.uploadMiddleware)({
    isRequired: false,
    multerMiddleware: (0, local_multer_js_1.localFileUpload)({ maxFileSize: 5 }).array("image"),
    customPath: "user",
    validation: local_multer_js_1.fileValidation.image,
}), (0, responce_middleware_js_1.responceFormatter)(async (req, res) => {
    const uploadedFile = Array.isArray(req.files) ? req.files[0] : req.file;
    const imagePath = uploadedFile?.finalPath || uploadedFile?.path;
    if (!imagePath) {
        throw new Error("No image was uploaded or path is missing");
    }
    const userRepository = new user_repository_js_1.UserRepository();
    const updatedUser = await userRepository.findByIdAndUpdate({
        id: req.user._id,
        data: { image: imagePath },
    });
    return { data: updatedUser };
}));
router.post("/follow/:id", (0, authentication_middleware_js_1.authentication)(), (0, validation_middleware_js_1.validation)(validator.followUser), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    await users_services_1.default.followUser(req.user._id.toString(), req.validate.params);
}));
router.post("/unfollow/:id", (0, authentication_middleware_js_1.authentication)(), (0, validation_middleware_js_1.validation)(validator.followUser), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    await users_services_1.default.unFollowUser(req.user._id.toString(), req.validate.params);
}));
router.get("/get-pending-follow-requests", (0, authentication_middleware_js_1.authentication)(), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    const data = await users_services_1.default.getPendingFollowRequests(req.user._id.toString());
    return { data };
}));
router.post("/accept-follow-request/:id", (0, authentication_middleware_js_1.authentication)(), (0, validation_middleware_js_1.validation)(validator.followUser), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    await users_services_1.default.acceptFollowRequest(req.user._id.toString(), req.validate.params);
}));
router.post("/reject-follow-request/:id", (0, authentication_middleware_js_1.authentication)(), (0, validation_middleware_js_1.validation)(validator.followUser), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    await users_services_1.default.rejectFollowRequest(req.user._id.toString(), req.validate.params);
}));
router.post("/toggle-private", (0, authentication_middleware_js_1.authentication)(), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    await users_services_1.default.togglePrivate(req.user._id.toString());
}));
router.get("/search", (0, authentication_middleware_js_1.authentication)(), (0, validation_middleware_js_1.validation)(validator.search), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    const data = await users_services_1.default.searchUser(req.validate.query, req.user._id.toString());
    return { data };
}));
router.get("/suggestions", (0, authentication_middleware_js_1.authentication)(), (0, responce_middleware_js_1.responceFormatter)(async (req, res, next) => {
    const data = await users_services_1.default.suggestions(req.user._id.toString());
    return { data };
}));
exports.default = router;
