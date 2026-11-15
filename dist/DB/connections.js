"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_js_1 = require("../config.js");
const user_model_js_1 = require("./module/user.model.js");
const cache_service_js_1 = require("../common/service/cache.service.js");
const telegram_service_js_1 = require("../common/service/telegram.service.js");
const index_js_1 = require("../modules/accounting/index.js");
const index_js_2 = require("../modules/branches/index.js");
const index_js_3 = require("../modules/notifications/index.js");
const bootstrapDB = async (app, port) => {
    try {
        await mongoose_1.default.connect(config_js_1.DB_URI, { serverSelectionTimeoutMS: 30000 });
        console.log(`DB Connected Successfully ❤️`);
        await user_model_js_1.UserModel.syncIndexes();
        for (const model of Object.values(mongoose_1.default.models)) {
            await model.createCollection().catch(() => { });
        }
        await index_js_1.accountingService.ensureChartOfAccounts();
        await index_js_2.branchService.ensureDefaultCompanyAndHQBranch();
        await telegram_service_js_1.telegramService.ensureDefaultSettingsAndLoad();
        await cache_service_js_1.cacheService.connect();
        if (config_js_1.NODE_ENV !== "test" && config_js_1.JOB_QUEUE_INTERVAL_MS > 0) {
            const timer = setInterval(() => {
                index_js_3.notificationJobService.runScheduledOperationalJobs().catch(() => { });
            }, config_js_1.JOB_QUEUE_INTERVAL_MS);
            timer.unref();
        }
        if (config_js_1.NODE_ENV !== "test") {
            telegram_service_js_1.telegramService.startPolling();
        }
        app.listen(port, () => {
            console.log(`server starting in port ${port} 👌`);
        });
    }
    catch (error) {
        console.log(error, "Error from mongo db connection");
        console.log(`Fail To Connect in DB 😢`);
    }
};
exports.bootstrapDB = bootstrapDB;
