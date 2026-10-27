import express from "express";
import { authenticationController } from "./modules";
import { globalErrorHandling } from "./middleware";

const app: express.Application = express();

app.use(express.json());

app.all("/", async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  res.status(200).json({ message: "Done" });
  return;
});

app.use("/auth", authenticationController);

app.use(globalErrorHandling);

app.listen(3000, () => {
  console.log(`server is running in 3000`);
});
