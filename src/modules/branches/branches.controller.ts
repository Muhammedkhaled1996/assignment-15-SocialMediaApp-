import { Router, Request } from "express";
import { authentication, authorizeRoles, responceFormatter, validation } from "../../middleware";
import { ALL_USER_ROLES, UserRole } from "../../common/enum";
import { branchService } from "./branches.service";
import { createBranchValidator, updateBranchValidator } from "./branches.validation";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(...ALL_USER_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await branchService.listBranches(req.query, req);
    return { data };
  }),
);

router.get(
  "/:id",
  authentication(),
  authorizeRoles(...ALL_USER_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await branchService.getBranchById(req.params.id as string, req);
    return { data };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validation(createBranchValidator),
  responceFormatter(async (req: Request) => {
    const data = await branchService.createBranch(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.patch(
  "/:id",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validation(updateBranchValidator),
  responceFormatter(async (req: Request) => {
    const data = await branchService.updateBranch(req.validate.params.id, req.validate.body, req);
    return { data };
  }),
);

export const branchesController = router;
export default router;
