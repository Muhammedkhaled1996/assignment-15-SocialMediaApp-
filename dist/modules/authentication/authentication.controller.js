"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authentication_service_1 = __importDefault(require("./authentication.service"));
const middleware_1 = require("../../middleware");
const router = (0, express_1.Router)();
router.post("/signup", (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.signup(req.body);
    return { status: 201, data };
}));
exports.default = router;
