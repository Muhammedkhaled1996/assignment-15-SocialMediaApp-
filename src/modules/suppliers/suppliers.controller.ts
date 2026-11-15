import { Router, Request } from "express";
import { auditService } from "../../common/service";
import { authentication, authorizeRoles, responceFormatter, validation } from "../../middleware";
import { UserRole } from "../../common/enum";
import { withTransaction } from "../../common/utils";
import { supplierService } from "./suppliers.service";
import { createSupplierValidator, recordLedgerAdjustmentValidator } from "./suppliers.validation";

const router = Router({ caseSensitive: true, strict: true });

const SUPPLIER_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.PROCUREMENT,
  UserRole.OPERATIONS,
];

router.get(
  "/",
  authentication(),
  authorizeRoles(...SUPPLIER_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await supplierService.listSuppliers(req.query as Record<string, string>);
    return { data };
  }),
);

router.get(
  "/aging-report",
  authentication(),
  authorizeRoles(...SUPPLIER_ROLES),
  responceFormatter(async () => {
    const data = await supplierService.getAgingAndScheduleReport();
    return { data };
  }),
);

router.get(
  "/:id/statement",
  authentication(),
  authorizeRoles(...SUPPLIER_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await supplierService.getSupplierStatement(req.params.id as string, req.query as any);
    return { data };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(...SUPPLIER_ROLES),
  validation(createSupplierValidator),
  responceFormatter(async (req: Request) => {
    const data = await supplierService.createSupplier(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.post(
  "/:id/ledger-entries",
  authentication(),
  authorizeRoles(...SUPPLIER_ROLES),
  validation(recordLedgerAdjustmentValidator),
  responceFormatter(async (req: Request) => {
    const body = req.validate.body;
    const data = await withTransaction(async (session) => {
      const res = await supplierService.recordLedgerMovement({
        supplierId: req.validate.params.id,
        branchId: req.branchContext?.activeBranchId,
        entryType: body.entryType,
        referenceType: "MANUAL_ADJUSTMENT",
        referenceId: req.validate.params.id,
        referenceNumber: body.referenceNumber,
        description: body.description,
        debitAmount: body.debitAmount,
        creditAmount: body.creditAmount,
        exchangeRateToEgp: body.exchangeRateToEgp,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        actorId: req.user?._id,
        session,
      });
      await auditService.record({
        req,
        action: `SUPPLIER_LEDGER_${body.entryType}`,
        module: "suppliers",
        entityType: "SupplierLedgerEntry",
        entityId: res.entry._id.toString(),
        newValues: res.entry.toObject(),
        session,
      });
      return res;
    });
    return { status: 201, data };
  }),
);

export const suppliersController = router;
export default router;
