import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import authenticationService from "./authentication.service";
import { responceFormatter, validation } from "../../middleware";
import { IResponse } from "../../common/interface";
import * as validators from "./authentication.validation";

const router = Router();

router.post(
  "/signup",
  validation(validators.signup),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<object>> => {
    const data = await authenticationService.signup(req.validate.body);
    return { status: 201, data };
  }),
);

export default router;
