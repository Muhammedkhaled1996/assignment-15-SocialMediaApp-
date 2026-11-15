"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...enum_1.ALL_USER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const filter = {};
    if (!req.branchContext?.isCentralAdmin) {
        filter.$or = [
            { branchId: { $in: req.branchContext?.allowedBranchIds || [] } },
            { recipientUserId: req.user._id },
        ];
    }
    if (req.query.unreadOnly === "true") {
        filter.isRead = false;
    }
    const notifications = await module_1.NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(req.query.limit) || 50)
        .lean();
    return { data: notifications };
}));
router.patch("/:id/read", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...enum_1.ALL_USER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const filter = { _id: req.params.id };
    if (!req.branchContext?.isCentralAdmin) {
        Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, undefined, "branchId"));
    }
    const notif = await module_1.NotificationModel.findOneAndUpdate(filter, { $set: { isRead: true, readAt: new Date() } }, { returnDocument: "after" });
    if (!notif)
        throw new exception_1.NotFoundException("Notification not found");
    return { data: notif };
}));
exports.notificationsController = router;
exports.default = router;
