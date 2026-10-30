import mongoose from "mongoose";
import { DB_URI } from "../config.js";
import type { Application } from "express";
import { UserModel } from "./module/user.model.js";
import { cacheService } from "../common/service/cache.service.js";

export const bootstrapDB = async (app: Application, port: number) => {
  try {
    await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 30000 });
    console.log(`DB Connected Successfully ❤️`);
    await UserModel.syncIndexes();
    await cacheService.connect();
    app.listen(port, () => {
      console.log(`server starting in port ${port} 👌`);
    });
  } catch (error) {
    console.log(error, "Error from mongo db connection");
    console.log(`Fail To Connect in DB 😢`);
  }
};
