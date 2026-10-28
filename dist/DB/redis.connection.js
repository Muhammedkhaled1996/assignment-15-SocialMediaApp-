"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
exports.connectRedis = connectRedis;
const redis_1 = require("redis");
const config_1 = require("../config");
exports.client = (0, redis_1.createClient)({
    url: config_1.REDIS_URI,
});
async function connectRedis() {
    try {
        await exports.client.connect();
        console.log(`Redis connection stablish successfully`);
    }
    catch (error) {
        console.log(`Failed to stablish Redis connection`);
    }
}
