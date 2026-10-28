import { SignupDto } from "./dto/authentication.dto";

export class authenticationService {
  constructor() {
    console.log("IN");
  }

  signup = (data: SignupDto["body"]) => {
    const { userName, confirmPassword, email, gender, password, phone, privileges } = data;

    // throw new BadRequestException("Fail", "lol");
    return data;
  };
}

export default new authenticationService();
