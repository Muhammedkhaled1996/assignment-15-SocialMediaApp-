import { HUser } from "../../DB/module";
import { IUser } from "../interface/user.interface";

export interface IBranchScopeContext {
  isCentralAdmin: boolean;
  allowedBranchIds: string[];
  activeBranchId?: string | undefined;
  companyId?: string | undefined;
}

declare module "express-serve-static-core" {
  interface Request {
    validate: any;
    file: any;
    files: any;
    payload: any;
    user: IUser | HUser;
    rateLimit: any;
    requestId?: string | undefined;
    branchContext?: IBranchScopeContext | undefined;
  }
}
