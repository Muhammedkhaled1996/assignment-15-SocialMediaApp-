import { DatabaseRepository } from "./base.repository";
import { IUser } from "../interface/user.interface";
import { UserModel } from "../../DB/module";

export class UserRepository extends DatabaseRepository<IUser> {
  constructor() {
    super(UserModel);
  }
}
