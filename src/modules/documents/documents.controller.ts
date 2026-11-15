import { Router, Request } from "express";
import { authentication, authorizeRoles, responceFormatter } from "../../middleware";
import { UserRole } from "../../common/enum";
import { documentService } from "./documents.service";

const router = Router({ caseSensitive: true, strict: true });

const DOC_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.SALES,
  UserRole.OPERATIONS,
  UserRole.EMPLOYEE,
];

router.get(
  "/flyer/:tripId",
  authentication(),
  authorizeRoles(...DOC_READ_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await documentService.getFlyerData(
      req.params.tripId as string,
      (req.query.branchId as string) || req.branchContext?.activeBranchId,
    );
    return { data };
  }),
);

router.get(
  "/manifest/:tripId",
  authentication(),
  authorizeRoles(...DOC_READ_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await documentService.getPassengerManifest(req.params.tripId as string, req);
    return { data };
  }),
);

router.get(
  "/rooming-list/:tripId",
  authentication(),
  authorizeRoles(...DOC_READ_ROLES),
  responceFormatter(async (req: Request) => {
    const city = req.query.city ? String(req.query.city).toUpperCase().trim() : undefined;
    const data = await documentService.getRoomingList(req.params.tripId as string, city, req);
    return { data };
  }),
);

router.get(
  "/receipts/:receiptId",
  authentication(),
  authorizeRoles(...DOC_READ_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await documentService.getReceiptPrintData(req.params.receiptId as string, req);
    return { data };
  }),
);

export const documentsController = router;
export default router;
