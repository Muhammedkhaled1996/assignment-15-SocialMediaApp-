"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const node_dns_1 = __importDefault(require("node:dns"));
node_dns_1.default.setServers(["8.8.8.8", "8.8.4.4"]);
const express_1 = __importDefault(require("express"));
const modules_1 = require("./modules");
const middleware_1 = require("./middleware");
const config_1 = require("./config");
const connections_1 = require("./DB/connections");
const cors_1 = __importDefault(require("cors"));
const utils_1 = require("./common/utils");
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
(0, config_1.validateEnvironment)();
exports.app = (0, express_1.default)();
const allowedOriginsList = (config_1.ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin ||
            allowedOriginsList.length === 0 ||
            allowedOriginsList.includes("*") ||
            allowedOriginsList.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("unauthorized origin", { cause: { status: 401 } }));
        }
    },
    credentials: true,
};
if (config_1.NODE_ENV !== "test") {
    (0, connections_1.bootstrapDB)(exports.app, config_1.PORT);
}
const limiter = utils_1.rateLimiterService.generateLimiter({});
function sanitizeMongoInput(obj) {
    if (!obj || typeof obj !== "object")
        return obj;
    if (Array.isArray(obj))
        return obj.map(sanitizeMongoInput);
    for (const key of Object.keys(obj)) {
        if (key.startsWith("$") || key.includes(".")) {
            delete obj[key];
        }
        else if (typeof obj[key] === "object") {
            sanitizeMongoInput(obj[key]);
        }
    }
    return obj;
}
exports.app.use((0, cors_1.default)(corsOptions), (0, helmet_1.default)(), ...(config_1.NODE_ENV !== "test" ? [(0, morgan_1.default)("dev")] : []), limiter, express_1.default.json({ limit: "2mb" }), (req, _res, next) => {
    if (req.body)
        sanitizeMongoInput(req.body);
    next();
});
exports.app.use("/assets", express_1.default.static("./assets"));
exports.app.all("/", async (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Troziana Enterprise Travel ERP API is running",
        docs: "/api/v1/docs",
    });
    return;
});
const v1Router = express_1.default.Router({ caseSensitive: true, strict: true });
v1Router.use("/auth", modules_1.authenticationController);
v1Router.use("/users", modules_1.usersController);
v1Router.use("/branches", modules_1.branchesController);
v1Router.use("/suppliers", modules_1.suppliersController);
v1Router.use("/flights", modules_1.flightsController);
v1Router.use("/hotels", modules_1.hotelsController);
v1Router.use("/pricing", modules_1.pricingController);
v1Router.use("/trips", modules_1.tripsController);
v1Router.use("/quotas", modules_1.quotasController);
v1Router.use("/passengers", modules_1.passengersController);
v1Router.use("/bookings", modules_1.bookingsController);
v1Router.use("/wholesale", modules_1.wholesaleController);
v1Router.use("/cashboxes", modules_1.cashboxesController);
v1Router.use("/receipts", modules_1.receiptsController);
v1Router.use("/expenses", modules_1.expensesController);
v1Router.use("/transfers", modules_1.transfersController);
v1Router.use("/accounting", modules_1.accountingController);
v1Router.use("/documents", modules_1.documentsController);
v1Router.use("/reports", modules_1.reportsController);
v1Router.use("/notifications", modules_1.notificationsController);
v1Router.use("/audit-logs", modules_1.auditLogsController);
v1Router.use("/settings", modules_1.settingsController);
v1Router.use("/", modules_1.docsController);
exports.app.use("/api/v1", v1Router);
exports.app.use(middleware_1.globalErrorHandling);
exports.default = exports.app;
