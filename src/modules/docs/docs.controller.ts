import { Router, Request, Response } from "express";
import { loadOpenApiSpec, renderSwaggerUiHtml } from "./docs.service";

const router = Router();

router.get("/openapi.json", (_req: Request, res: Response) => {
  res.status(200).json(loadOpenApiSpec());
});

router.get("/docs", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html");
  res.status(200).send(renderSwaggerUiHtml());
});

export const docsController = router;
export default router;
