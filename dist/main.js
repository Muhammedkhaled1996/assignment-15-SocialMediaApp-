"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const app = (0, express_1.default)();
var corsOptions = {
    origin: function (origin, callback) {
        if (!config_1.ORIGINS.includes(origin)) {
            callback(new Error("unauthorized origin", { cause: { status: 401 } }));
        }
        else {
            callback(null, config_1.ORIGINS);
        }
    },
};
(0, connections_1.bootstrapDB)(app, config_1.PORT);
const limiter = utils_1.rateLimiterService.generateLimiter({});
app.use((0, cors_1.default)(), (0, helmet_1.default)(), (0, morgan_1.default)("dev"), limiter, express_1.default.json());
app.use("/assets", express_1.default.static("./assets"));
app.all("/", async (req, res, next) => {
    res.status(200).json({ message: "Done" });
    return;
});
app.use("/auth", modules_1.authenticationController);
app.use("/user", modules_1.usersController);
app.use(middleware_1.globalErrorHandling);
