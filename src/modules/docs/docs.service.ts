import fs from "node:fs";
import path from "node:path";

const openApiFilePath = path.resolve(process.cwd(), "docs", "openapi.json");

export function loadOpenApiSpec(): Record<string, any> {
  try {
    const raw = fs.readFileSync(openApiFilePath, "utf8");
    return JSON.parse(raw);
  } catch {
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

export function renderSwaggerUiHtml(): string {
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
