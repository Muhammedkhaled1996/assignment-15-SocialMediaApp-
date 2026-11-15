import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import express from "express";
import {
  accountingController,
  auditLogsController,
  authenticationController,
  bookingsController,
  branchesController,
  cashboxesController,
  docsController,
  documentsController,
  expensesController,
  flightsController,
  hotelsController,
  notificationsController,
  passengersController,
  pricingController,
  quotasController,
  receiptsController,
  reportsController,
  settingsController,
  suppliersController,
  transfersController,
  tripsController,
  usersController,
  wholesaleController,
} from "./modules";
import { globalErrorHandling } from "./middleware";
import { NODE_ENV, ORIGINS, PORT, validateEnvironment } from "./config";
import { bootstrapDB } from "./DB/connections";
import cors from "cors";
import { rateLimiterService } from "./common/utils";
import helmet from "helmet";
import morgan from "morgan";

validateEnvironment();

export const app: express.Application = express();

// allow frontend to access apis
const allowedOriginsList = (ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      allowedOriginsList.length === 0 ||
      allowedOriginsList.includes("*") ||
      allowedOriginsList.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error("unauthorized origin", { cause: { status: 401 } }));
    }
  },
  credentials: true,
};

if (NODE_ENV !== "test") {
  bootstrapDB(app, PORT);
}

const limiter = rateLimiterService.generateLimiter({});

// MongoDB operator injection sanitizer ($ and . keys in body/query)
function sanitizeMongoInput(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeMongoInput);
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      sanitizeMongoInput(obj[key]);
    }
  }
  return obj;
}

app.use(
  cors(corsOptions),
  helmet(),
  ...(NODE_ENV !== "test" ? [morgan("dev")] : []),
  limiter,
  express.json({ limit: "2mb" }),
  (req, _res, next) => {
    if (req.body) sanitizeMongoInput(req.body);
    next();
  },
);
app.use("/assets", express.static("./assets"));

app.all("/", async (_req: express.Request, res: express.Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message: "Troziana Enterprise Travel ERP API is running",
    docs: "/api/v1/docs",
  });
  return;
});

// Versioned Enterprise ERP REST API (/api/v1)
const v1Router = express.Router({ caseSensitive: true, strict: true });
v1Router.use("/auth", authenticationController);
v1Router.use("/users", usersController);
v1Router.use("/branches", branchesController);
v1Router.use("/suppliers", suppliersController);
v1Router.use("/flights", flightsController);
v1Router.use("/hotels", hotelsController);
v1Router.use("/pricing", pricingController);
v1Router.use("/trips", tripsController);
v1Router.use("/quotas", quotasController);
v1Router.use("/passengers", passengersController);
v1Router.use("/bookings", bookingsController);
v1Router.use("/wholesale", wholesaleController);
v1Router.use("/cashboxes", cashboxesController);
v1Router.use("/receipts", receiptsController);
v1Router.use("/expenses", expensesController);
v1Router.use("/transfers", transfersController);
v1Router.use("/accounting", accountingController);
v1Router.use("/documents", documentsController);
v1Router.use("/reports", reportsController);
v1Router.use("/notifications", notificationsController);
v1Router.use("/audit-logs", auditLogsController);
v1Router.use("/settings", settingsController);
v1Router.use("/", docsController);

app.use("/api/v1", v1Router);

app.use(globalErrorHandling);
export default app;
