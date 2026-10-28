"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_js_1 = require("../config.js");
const redis_connection_js_1 = require("./redis.connection.js");
const bootstrapDB = async (app, port) => {
    try {
        await mongoose_1.default.connect(config_js_1.DB_URI, { serverSelectionTimeoutMS: 30000 });
        console.log(`DB Connected Successfully ❤️`);
        await (0, redis_connection_js_1.connectRedis)();
        app.listen(port, () => {
            console.log(`server starting in port ${port} 👌`);
        });
    }
    catch (error) {
        console.log(error);
        console.log(`Fail To Connect in DB 😢`);
    }
};
exports.bootstrapDB = bootstrapDB;
