"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOTP = void 0;
const createOTP = () => {
    return Math.floor(Math.random() * (999999 - 100000 + 1) + 100000);
};
exports.createOTP = createOTP;
