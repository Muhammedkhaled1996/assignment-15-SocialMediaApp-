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
const bootstrapDB = async (app, port) => {
    try {
        await mongoose_1.default.connect(config_js_1.DB_URI, { serverSelectionTimeoutMS: 30000 });
        console.log(`DB Connected Successfully ❤️`);
        await user_model_js_1.UserModel.syncIndexes();
        await cache_service_js_1.cacheService.connect();
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
