"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectStatusEnum = void 0;
var connectStatusEnum;
(function (connectStatusEnum) {
    connectStatusEnum[connectStatusEnum["PENDING"] = 0] = "PENDING";
    connectStatusEnum[connectStatusEnum["ACCEPTED"] = 1] = "ACCEPTED";
    connectStatusEnum[connectStatusEnum["REJECTED"] = 2] = "REJECTED";
})(connectStatusEnum || (exports.connectStatusEnum = connectStatusEnum = {}));
