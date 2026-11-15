"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.docsController = void 0;
const express_1 = require("express");
const docs_service_1 = require("./docs.service");
const router = (0, express_1.Router)();
router.get("/openapi.json", (_req, res) => {
    res.status(200).json((0, docs_service_1.loadOpenApiSpec)());
});
router.get("/docs", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.status(200).send((0, docs_service_1.renderSwaggerUiHtml)());
});
exports.docsController = router;
exports.default = router;
