"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const domain_exception_js_1 = require("../../common/exception/domain.exception.js");
const user_repository_js_1 = require("../../common/repository/user.repository.js");
class UserService {
    userRepository;
    constructor() {
        this.userRepository = new user_repository_js_1.UserRepository();
    }
    Profile(user) {
        return user;
    }
    async update(user, { userName }) {
        const existingUser = await this.userRepository.findById({ id: user.id });
        if (!existingUser) {
            throw new domain_exception_js_1.NotFoundException("user not found");
        }
        existingUser.userName = userName;
        await existingUser.save();
        return existingUser;
    }
}
exports.UserService = UserService;
exports.default = new UserService();
