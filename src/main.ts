import express from "express";
import { authenticationController } from "./modules";
import { globalErrorHandling } from "./middleware";
import { PORT } from "./config";
import { bootstrapDB } from "./DB/connections";

const app: express.Application = express();

bootstrapDB(app, PORT);

app.use(express.json());

app.all("/", async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  res.status(200).json({ message: "Done" });
  return;
});

app.use("/auth", authenticationController);

app.use(globalErrorHandling);
