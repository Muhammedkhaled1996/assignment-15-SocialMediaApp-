import { HUser } from "../../DB/module";
import { IUser } from "../interface/user.interface";

declare module "express-serve-static-core" {
  interface Request {
    validate: any;
    file: any;
    files: any;
    payload: any;
    user: IUser | HUser;
    rateLimit: any;
  }
}
