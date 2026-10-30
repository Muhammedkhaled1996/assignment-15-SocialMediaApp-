"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationService = void 0;
const exception_1 = require("../../common/exception");
const repository_1 = require("../../common/repository");
const service_1 = require("../../common/service");
const security_1 = require("../../common/security");
const google_auth_library_1 = require("google-auth-library");
const utils_1 = require("../../common/utils");
const enum_1 = require("../../common/enum");
const email_event_1 = require("../../common/utils/email/email.event");
const config_1 = require("../../config");
class AuthenticationService {
    userRepository;
    cacheService;
    client;
    token;
    constructor() {
        this.userRepository = new repository_1.UserRepository();
        this.cacheService = service_1.cacheService;
        this.client = new google_auth_library_1.OAuth2Client();
        this.token = security_1.tokenSecurityService;
    }
    async sendEmailOtp({ account, subject, expiresIn = 120, maxTrails = 3, blockInSeconds = 300, }) {
        const email = account.email;
        const existOtpTtl = await this.cacheService.ttl({ key: (0, utils_1.UserEmailKey)({ email, subject }) });
        if (existOtpTtl > 0) {
            throw new exception_1.BadRequestException(`Sorry we cannot create new otp while existing one still try again later after ${existOtpTtl}s`);
        }
        const oldTrails = (await this.cacheService.get({ key: (0, utils_1.UserEmailTrailsKey)({ email, subject }) })) ?? 0;
        if (oldTrails >= maxTrails) {
            throw new exception_1.TooManyRequestException("Max otp trails has been reached");
        }
        const code = (0, utils_1.createOTP)();
        await this.cacheService.set({
            key: (0, utils_1.UserEmailKey)({ email, subject }),
            value: await (0, security_1.hashed)({ plainText: code.toString() }),
            ttl: expiresIn,
        });
        const currentTrails = await this.cacheService.incrementBy({
            key: (0, utils_1.UserEmailTrailsKey)({ email, subject }),
            count: 1,
        });
        if (currentTrails == 3) {
            await this.cacheService.expire({ key: (0, utils_1.UserEmailTrailsKey)({ email, subject }), ttl: blockInSeconds });
        }
        email_event_1.emailEvent.emit("sendEmail", {
            recipients: { to: email },
            subject,
            data: { code, userName: account.userName },
        });
        return;
    }
    async verifyGoogleAccount(idToken) {
        const ticket = await this.client.verifyIdToken({
            idToken,
            audience: config_1.WEB_CLIENT_IDS,
        });
        const payload = ticket.getPayload();
        return payload;
    }
    async signup(inputs, issuer) {
        const { email, password, confirmPassword, userName, phone } = inputs;
        console.log({ email, password, confirmPassword, userName, phone });
        const userExists = await this.userRepository.findOne({
            filter: { email },
        });
        if (userExists) {
            throw new exception_1.ConflictException("User already exists");
        }
        const account = await this.userRepository.create({
            data: {
                email,
                password: await (0, security_1.hashed)({ plainText: password }),
                confirmPassword: await (0, security_1.hashed)({ plainText: confirmPassword }),
                userName,
                phone: await (0, security_1.encryption)(phone),
            },
        });
        await this.sendEmailOtp({ account, subject: enum_1.EmailSubjectEnum.CONFIRM_EMAIL });
        return { message: "Account created successfully. Please check your email for confirmation." };
    }
    async resendEmail(inputs) {
        const { email } = inputs;
        console.log({ email });
        const account = await this.userRepository.findOne({
            filter: { email, provider: enum_1.providerEnum.SYSTEM, confirmEmail: { $exists: false } },
        });
        if (!account) {
            throw new exception_1.NotFoundException("Invalid email");
        }
        await this.sendEmailOtp({ account, subject: enum_1.EmailSubjectEnum.CONFIRM_EMAIL });
        return;
    }
    async confirmEmail(inputs) {
        const { email, otp } = inputs;
        console.log({ email, otp });
        const account = await this.userRepository.findOne({
            filter: { email, provider: enum_1.providerEnum.SYSTEM, confirmEmail: { $exists: false } },
        });
        if (!account) {
            throw new exception_1.NotFoundException("Invalid email");
        }
        const userKey = (0, utils_1.UserEmailKey)({ email, subject: enum_1.EmailSubjectEnum.CONFIRM_EMAIL });
        const hashOtp = await this.cacheService.get({ key: userKey });
        if (!hashOtp || !(await (0, security_1.compared)({ ciperText: hashOtp, plainText: otp.toString() }))) {
            throw new exception_1.ConflictException("Invalid otp");
        }
        account.confirmEmail = new Date();
        await account.save();
        await this.cacheService.del({ key: await this.cacheService.keys({ prefix: userKey }) });
        return;
    }
    async login(inputs, issuer) {
        const { email, password } = inputs;
        const user = (await this.userRepository.findOne({
            filter: { email, provider: enum_1.providerEnum.SYSTEM, confirmEmail: { $exists: true } },
        }));
        if (!user) {
            throw new exception_1.NotFoundException("Invalid credentials");
        }
        const cipherPassword = user.password;
        const match = await (0, security_1.compared)({
            ciperText: cipherPassword,
            plainText: password,
        });
        if (!match) {
            throw new exception_1.NotFoundException("Invalid credentials");
        }
        await this.cacheService.del({ key: [(0, utils_1.UserLoginTrailsKey)({ email, subject: "LOGIN" })] });
        const { access_token, refresh_token } = await this.token.createLoginCredentials(user, issuer);
        return { access_token, refresh_token };
    }
    async rotateToken(payload, user) {
        const accessExpiresIn = (payload.iat + config_1.ACCESS_TOKEN_EXPIRES_IN) * 1000;
        const currentTime = Date.now() + 5 * 60000;
        if (currentTime < accessExpiresIn) {
            throw new exception_1.ConflictException("Sorry we cannot create new login credentials while current access token still within valid time range");
        }
        const { access_token, refresh_token } = await this.token.createLoginCredentials(user);
        await this.token.createRevokeToken({ payload });
        return { access_token, refresh_token };
    }
    async siginUpWithGmail({ idToken }, issuer) {
        const { name, email, picture, email_verified } = await this.verifyGoogleAccount(idToken);
        if (!email_verified) {
            throw new exception_1.BadRequestException("Email not verified");
        }
        const existAccount = await this.userRepository.findOne({ filter: { email } });
        if (existAccount) {
            if (existAccount.provider != enum_1.providerEnum.GOOGLE) {
                throw new exception_1.ConflictException("Invalid account provider");
            }
            return {
                status: 200,
                data: await this.token.createLoginCredentials(existAccount, issuer),
            };
        }
        const user = await this.userRepository.createOne({
            data: {
                userName: name,
                email,
                confirmEmail: new Date(),
                provider: enum_1.providerEnum.GOOGLE,
                image: picture,
            },
        });
        return {
            status: 201,
            data: await this.token.createLoginCredentials(user, issuer),
        };
    }
    async logout(payload, user, inputs) {
        const { action } = inputs;
        switch (action) {
            case enum_1.LogoutEnum.ALL:
                user.changeCredentialsTime = new Date();
                await user.save();
                const keysCount = await this.cacheService.keys({
                    prefix: this.token.userBaseRevokeTokenKey({ userId: payload.sub }),
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
    async requestForgetPasswordCode(inputs) {
        const { email } = inputs;
        const account = await this.userRepository.findOne({
            filter: { email, provider: enum_1.providerEnum.SYSTEM, confirmEmail: { $exists: true } },
        });
        if (!account) {
            throw new exception_1.NotFoundException("Invalid credentials");
        }
        await this.sendEmailOtp({ account, subject: enum_1.EmailSubjectEnum.FORGET_PASSWORD });
        return;
    }
    async verifyForgotPasswordCode({ email, otp }) {
        const account = await this.userRepository.findOne({
            filter: { email, provider: enum_1.providerEnum.SYSTEM, confirmEmail: { $exists: true } },
        });
        if (!account) {
            throw new exception_1.NotFoundException("Invalid email");
        }
        const userKey = (0, utils_1.UserEmailKey)({ email, subject: enum_1.EmailSubjectEnum.FORGET_PASSWORD });
        const hashOtp = await this.cacheService.get({ key: userKey });
        if (!hashOtp || !(await (0, security_1.compared)({ ciperText: hashOtp, plainText: otp.toString() }))) {
            throw new exception_1.ConflictException("Invalid otp");
        }
        account.confirmEmail = new Date();
        await account.save();
        await this.cacheService.del({ key: await this.cacheService.keys({ prefix: userKey }) });
        return account;
    }
    async resetPasswordCode(inputs) {
        const { email, otp, password } = inputs;
        const account = await this.verifyForgotPasswordCode({ email, otp });
        account.password = await (0, security_1.hashed)({ plainText: password });
        account.changeCredentialsTime = new Date();
        await account.save();
        const result = await Promise.all([
            this.cacheService.keys({ prefix: (0, utils_1.UserEmailKey)({ email, subject: enum_1.EmailSubjectEnum.FORGET_PASSWORD }) }),
            this.cacheService.keys({ prefix: this.token.userBaseRevokeTokenKey({ userId: account._id.toString() }) }),
        ]);
        const keysToDelete = [...(result[0] || []), ...(result[1] || [])];
        if (keysToDelete.length > 0) {
            await this.cacheService.del({ key: keysToDelete });
        }
        return account;
    }
}
exports.AuthenticationService = AuthenticationService;
exports.default = new AuthenticationService();
