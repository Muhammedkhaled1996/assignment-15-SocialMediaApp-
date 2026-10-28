"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticationService = void 0;
class authenticationService {
    constructor() {
        console.log("IN");
    }
    signup = (data) => {
        const { userName, confirmPassword, email, gender, password, phone, privileges } = data;
        return data;
    };
}
exports.authenticationService = authenticationService;
exports.default = new authenticationService();
