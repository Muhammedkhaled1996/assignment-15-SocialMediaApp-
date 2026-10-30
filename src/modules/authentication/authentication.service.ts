import { IUser } from "../../common/interface/user.interface";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  TooManyRequestException,
} from "../../common/exception";
import { UserRepository } from "../../common/repository";
import { cacheService, CacheService } from "../../common/service";
import {
  compared,
  encryption,
  hashed,
  ICustomJwtPayload,
  tokenSecurityService,
  TokenSecurityService,
} from "../../common/security";
import { OAuth2Client } from "google-auth-library";
import { createOTP, UserEmailKey, UserEmailTrailsKey, UserLoginTrailsKey } from "../../common/utils";
import { EmailSubjectEnum, LogoutEnum, providerEnum } from "../../common/enum";
import { emailEvent } from "../../common/utils/email/email.event";
import { ACCESS_TOKEN_EXPIRES_IN, WEB_CLIENT_IDS } from "../../config";
import { ConfirmEmailDto, LoginDto, ResendOTPDto, SignupDto } from "./dto/authentication.dto";
import { HUser } from "../../DB/module";

export class AuthenticationService {
  private userRepository: UserRepository;
  private cacheService: CacheService;
  private client: OAuth2Client;
  private token: TokenSecurityService;
  constructor() {
    this.userRepository = new UserRepository();
    this.cacheService = cacheService;
    this.client = new OAuth2Client();
    this.token = tokenSecurityService;
  }

  // send email otp function
  async sendEmailOtp({
    account,
    subject,
    expiresIn = 120,
    maxTrails = 3,
    blockInSeconds = 300,
  }: {
    account: IUser;
    subject: EmailSubjectEnum;
    expiresIn?: number;
    maxTrails?: number;
    blockInSeconds?: number;
  }): Promise<void> {
    const email = account.email as string;
    const existOtpTtl = await this.cacheService.ttl({ key: UserEmailKey({ email, subject }) });

    if (existOtpTtl > 0) {
      throw new BadRequestException(
        `Sorry we cannot create new otp while existing one still try again later after ${existOtpTtl}s`,
      );
    }

    const oldTrails = (await this.cacheService.get({ key: UserEmailTrailsKey({ email, subject }) })) ?? 0;

    if (oldTrails >= maxTrails) {
      throw new TooManyRequestException("Max otp trails has been reached");
    }

    const code = createOTP();

    await this.cacheService.set({
      key: UserEmailKey({ email, subject }),
      value: await hashed({ plainText: code.toString() }),
      ttl: expiresIn,
    });

    const currentTrails = await this.cacheService.incrementBy({
      key: UserEmailTrailsKey({ email, subject }),
      count: 1,
    });

    if (currentTrails == 3) {
      await this.cacheService.expire({ key: UserEmailTrailsKey({ email, subject }), ttl: blockInSeconds });
    }

    emailEvent.emit("sendEmail", {
      recipients: { to: email },
      subject,
      data: { code, userName: account.userName as string },
    });
    return;
  }

  // // verify Google account function
  async verifyGoogleAccount(idToken: string): Promise<ICustomJwtPayload | undefined> {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: WEB_CLIENT_IDS,
    });
    const payload = ticket.getPayload();
    return payload;
  }

  // // signup function
  async signup(inputs: SignupDto["body"], issuer?: string): Promise<{ message: string }> {
    const { email, password, confirmPassword, userName, phone } = inputs;

    console.log({ email, password, confirmPassword, userName, phone });

    const userExists = await this.userRepository.findOne({
      filter: { email },
    });
    if (userExists) {
      throw new ConflictException("User already exists");
    }

    const account = await this.userRepository.create({
      data: {
        email,
        password: await hashed({ plainText: password }),
        confirmPassword: await hashed({ plainText: confirmPassword }),
        userName,
        phone: await encryption(phone as string),
      },
    });

    // const { access_token, refresh_token } = await createLoginCredentials(account[0], issuer);

    // Send confirm email with otp
    await this.sendEmailOtp({ account, subject: EmailSubjectEnum.CONFIRM_EMAIL });

    // return { access_token, refresh_token };
    return { message: "Account created successfully. Please check your email for confirmation." };
  }

  // resend email otp function
  async resendEmail(inputs: ResendOTPDto["body"]): Promise<void> {
    const { email } = inputs;

    console.log({ email });

    const account = await this.userRepository.findOne({
      filter: { email, provider: providerEnum.SYSTEM, confirmEmail: { $exists: false } },
    });

    if (!account) {
      throw new NotFoundException("Invalid email");
    }

    // Send confirm email with otp
    await this.sendEmailOtp({ account, subject: EmailSubjectEnum.CONFIRM_EMAIL });

    return;
  }

  // confirm email function
  async confirmEmail(inputs: ConfirmEmailDto["body"]): Promise<void> {
    const { email, otp } = inputs;
    console.log({ email, otp });

    const account = await this.userRepository.findOne({
      filter: { email, provider: providerEnum.SYSTEM, confirmEmail: { $exists: false } },
    });

    if (!account) {
      throw new NotFoundException("Invalid email");
    }

    const userKey = UserEmailKey({ email, subject: EmailSubjectEnum.CONFIRM_EMAIL });

    const hashOtp = await this.cacheService.get({ key: userKey });
    if (!hashOtp || !(await compared({ ciperText: hashOtp, plainText: otp.toString() }))) {
      throw new ConflictException("Invalid otp");
    }
    account.confirmEmail = new Date();
    await account.save();
    await this.cacheService.del({ key: await this.cacheService.keys({ prefix: userKey }) });
    return;
  }

  // login function
  async login(inputs: LoginDto["body"], issuer: string): Promise<{ access_token: string; refresh_token: string }> {
    const { email, password } = inputs;

    // await checkLoginBlocked({ email, subject: "LOGIN", maxTrails: 3 });

    const user = (await this.userRepository.findOne({
      filter: { email, provider: providerEnum.SYSTEM, confirmEmail: { $exists: true } },
    })) as IUser;

    if (!user) {
      // await recordFailedAttempt({ email, subject: "LOGIN", maxTrails: 3, blockInSeconds: 300, windowInSeconds: 60 });
      throw new NotFoundException("Invalid credentials");
    }

    const cipherPassword = user.password;

    const match = await compared({
      ciperText: cipherPassword,
      plainText: password,
    });

    if (!match) {
      // await recordFailedAttempt({ email, subject: "LOGIN" });
      throw new NotFoundException("Invalid credentials");
    }

    await this.cacheService.del({ key: [UserLoginTrailsKey({ email, subject: "LOGIN" })] });

    const { access_token, refresh_token } = await this.token.createLoginCredentials(
      user as IUser & { _id: string },
      issuer,
    );
    return { access_token, refresh_token };
  }

  // rotate token function
  async rotateToken(payload: any, user: IUser): Promise<{ access_token: string; refresh_token: string }> {
    const accessExpiresIn = (payload.iat + ACCESS_TOKEN_EXPIRES_IN) * 1000;
    const currentTime = Date.now() + 5 * 60000;

    if (currentTime < accessExpiresIn) {
      throw new ConflictException(
        "Sorry we cannot create new login credentials while current access token still within valid time range",
      );
    }

    const { access_token, refresh_token } = await this.token.createLoginCredentials(user as IUser & { _id: string });
    await this.token.createRevokeToken({ payload });
    return { access_token, refresh_token };
  }

  // signup with Gmail function
  async siginUpWithGmail({ idToken }: { idToken: string }, issuer?: string) {
    const { name, email, picture, email_verified }: any = await this.verifyGoogleAccount(idToken);

    if (!email_verified) {
      throw new BadRequestException("Email not verified");
    }

    const existAccount: IUser | null = await this.userRepository.findOne({ filter: { email } });

    if (existAccount) {
      if (existAccount.provider != providerEnum.GOOGLE) {
        throw new ConflictException("Invalid account provider");
      }
      return {
        status: 200,
        data: await this.token.createLoginCredentials(existAccount as IUser & { _id: string }, issuer),
      };
    }

    const user: IUser | null = await this.userRepository.createOne({
      data: {
        userName: name,
        email,
        confirmEmail: new Date(),
        provider: providerEnum.GOOGLE,
        image: picture,
      },
    });

    return {
      status: 201,
      data: await this.token.createLoginCredentials(user as IUser & { _id: string }, issuer),
    };
  }

  // logout function
  async logout(payload: ICustomJwtPayload, user: HUser, inputs: { action: number }): Promise<void> {
    const { action } = inputs;

    switch (action) {
      case LogoutEnum.ALL:
        user.changeCredentialsTime = new Date();
        await user.save();
        const keysCount = await this.cacheService.keys({
          prefix: this.token.userBaseRevokeTokenKey({ userId: payload.sub! }),
        });

        if (keysCount && keysCount.length > 0) {
          await this.cacheService.del({ key: keysCount });
        }

        break;

      default:
        await this.token.createRevokeToken({ payload });
        break;
    }

    return;
  }

  // forget password
  async requestForgetPasswordCode(inputs: { email: string }): Promise<void> {
    const { email } = inputs;

    const account = await this.userRepository.findOne({
      filter: { email, provider: providerEnum.SYSTEM, confirmEmail: { $exists: true } },
    });

    if (!account) {
      throw new NotFoundException("Invalid credentials");
    }

    await this.sendEmailOtp({ account, subject: EmailSubjectEnum.FORGET_PASSWORD });

    return;
  }

  // verify forgot password
  async verifyForgotPasswordCode({ email, otp }: { email: string; otp: number }): Promise<HUser> {
    const account = await this.userRepository.findOne({
      filter: { email, provider: providerEnum.SYSTEM, confirmEmail: { $exists: true } },
    });

    if (!account) {
      throw new NotFoundException("Invalid email");
    }

    const userKey = UserEmailKey({ email, subject: EmailSubjectEnum.FORGET_PASSWORD });

    const hashOtp = await this.cacheService.get({ key: userKey });
    if (!hashOtp || !(await compared({ ciperText: hashOtp, plainText: otp.toString() }))) {
      throw new ConflictException("Invalid otp");
    }
    account.confirmEmail = new Date();
    await account.save();
    await this.cacheService.del({ key: await this.cacheService.keys({ prefix: userKey }) });
    return account;
  }

  // reset forgot password
  async resetPasswordCode(inputs: { email: string; otp: number; password: string }): Promise<IUser> {
    const { email, otp, password } = inputs;
    const account = await this.verifyForgotPasswordCode({ email, otp });

    account.password = await hashed({ plainText: password });
    account.changeCredentialsTime = new Date();
    await account.save();

    const result = await Promise.all([
      this.cacheService.keys({ prefix: UserEmailKey({ email, subject: EmailSubjectEnum.FORGET_PASSWORD }) }),
      this.cacheService.keys({ prefix: this.token.userBaseRevokeTokenKey({ userId: account._id.toString() }) }),
    ]);

    const keysToDelete = [...(result[0] || []), ...(result[1] || [])];

    if (keysToDelete.length > 0) {
      await this.cacheService.del({ key: keysToDelete });
    }
    return account;
  }
}

export default new AuthenticationService();
