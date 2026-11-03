"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const base_repository_1 = require("./base.repository");
const module_1 = require("../../DB/module");
class UserRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.UserModel);
    }
}
exports.UserRepository = UserRepository;
