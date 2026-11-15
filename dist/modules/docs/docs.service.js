"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadOpenApiSpec = loadOpenApiSpec;
exports.renderSwaggerUiHtml = renderSwaggerUiHtml;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const openApiFilePath = node_path_1.default.resolve(process.cwd(), "docs", "openapi.json");
function loadOpenApiSpec() {
    try {
        const raw = node_fs_1.default.readFileSync(openApiFilePath, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return {
            openapi: "3.0.3",
            info: {
                title: "Troziana Enterprise Travel & Umrah ERP API",
                version: "1.0.0",
            },
            paths: {},
        };
    }
}
function renderSwaggerUiHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Troziana Enterprise Travel ERP — API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`;
}
