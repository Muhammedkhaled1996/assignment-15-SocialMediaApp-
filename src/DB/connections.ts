import mongoose from "mongoose";
import { DB_URI, JOB_QUEUE_INTERVAL_MS, NODE_ENV } from "../config.js";
import type { Application } from "express";
import { UserModel } from "./module/user.model.js";
import { cacheService } from "../common/service/cache.service.js";
import { telegramService } from "../common/service/telegram.service.js";
import { accountingService } from "../modules/accounting/index.js";
import { branchService } from "../modules/branches/index.js";
import { notificationJobService } from "../modules/notifications/index.js";

export const bootstrapDB = async (app: Application, port: number) => {
  try {
    await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 30000 });
    console.log(`DB Connected Successfully ❤️`);
    await UserModel.syncIndexes();
    for (const model of Object.values(mongoose.models)) {
      await model.createCollection().catch(() => {});
    }
    await accountingService.ensureChartOfAccounts();
    await branchService.ensureDefaultCompanyAndHQBranch();
    await telegramService.ensureDefaultSettingsAndLoad();
    await cacheService.connect();

    if (NODE_ENV !== "test" && JOB_QUEUE_INTERVAL_MS > 0) {
      const timer = setInterval(() => {
        notificationJobService.runScheduledOperationalJobs().catch(() => {});
      }, JOB_QUEUE_INTERVAL_MS);
      timer.unref();
    }

    if (NODE_ENV !== "test") {
      telegramService.startPolling();
    }

    app.listen(port, () => {
      console.log(`server starting in port ${port} 👌`);
    });
  } catch (error) {
    console.log(error, "Error from mongo db connection");
    console.log(`Fail To Connect in DB 😢`);
  }
};
