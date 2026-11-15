import { Router, Request } from "express";
import { NotificationModel } from "../../DB/module";
import { NotFoundException } from "../../common/exception";
import { authentication, authorizeRoles, resolveScopedBranchFilter, responceFormatter } from "../../middleware";
import { ALL_USER_ROLES } from "../../common/enum";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(...ALL_USER_ROLES),
  responceFormatter(async (req: Request) => {
    const filter: Record<string, any> = {};
    if (!req.branchContext?.isCentralAdmin) {
      filter.$or = [
        { branchId: { $in: req.branchContext?.allowedBranchIds || [] } },
        { recipientUserId: req.user._id },
      ];
    }
    if (req.query.unreadOnly === "true") {
      filter.isRead = false;
    }
    const notifications = await NotificationModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 50)
      .lean();
    return { data: notifications };
  }),
);

router.patch(
  "/:id/read",
  authentication(),
  authorizeRoles(...ALL_USER_ROLES),
  responceFormatter(async (req: Request) => {
    const filter: Record<string, any> = { _id: req.params.id };
    if (!req.branchContext?.isCentralAdmin) {
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));
    }
    const notif = await NotificationModel.findOneAndUpdate(
      filter,
      { $set: { isRead: true, readAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!notif) throw new NotFoundException("Notification not found");
    return { data: notif };
  }),
);

export const notificationsController = router;
export default router;
