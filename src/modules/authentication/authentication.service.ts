import { BadRequestException } from "../../common/exception";

export class authenticationService {
  constructor() {
    console.log("IN");
  }

  signup(data: object): object {
    // throw new BadRequestException("Fail", "lol");
    return data;
  }
}

export default new authenticationService();
