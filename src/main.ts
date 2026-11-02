import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import express from "express";
import { authenticationController, usersController } from "./modules";
import { globalErrorHandling } from "./middleware";
import { ORIGINS, PORT } from "./config";
import { bootstrapDB } from "./DB/connections";
import cors from "cors";
import { rateLimiterService } from "./common/utils";
import helmet from "helmet";
import morgan from "morgan";
const app: express.Application = express();

// allow frontend to access apis
var corsOptions = {
  origin: function (origin: string, callback: Function) {
    if (!ORIGINS.includes(origin)) {
      callback(new Error("unauthorized origin", { cause: { status: 401 } }));
    } else {
      callback(null, ORIGINS);
    }
  },
};

bootstrapDB(app, PORT);

const limiter = rateLimiterService.generateLimiter({});

app.use(cors(), helmet(), morgan("dev"), limiter, express.json());
app.use("/assets", express.static("./assets"));


app.all("/", async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  res.status(200).json({ message: "Done" });
  return;
});

app.use("/auth", authenticationController);
app.use("/user", usersController);

app.use(globalErrorHandling);
