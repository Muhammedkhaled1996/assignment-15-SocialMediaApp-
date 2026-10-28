import mongoose from "mongoose";
import { DB_URI } from "../config.js";
import { connectRedis } from "./redis.connection.js";
import type { Application } from "express";

export const bootstrapDB = async (app: Application, port: number) => {
  try {
    await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 30000 });
    console.log(`DB Connected Successfully ❤️`);
    // await UserModel.syncIndexes();
    await connectRedis();
    app.listen(port, () => {
      console.log(`server starting in port ${port} 👌`);
    });
  } catch (error) {
    console.log(error);
    console.log(`Fail To Connect in DB 😢`);
  }
};
