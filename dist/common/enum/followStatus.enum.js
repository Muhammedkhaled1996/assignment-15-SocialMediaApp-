"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowStatus = void 0;
var FollowStatus;
(function (FollowStatus) {
    FollowStatus[FollowStatus["PENDING"] = 0] = "PENDING";
    FollowStatus[FollowStatus["ACCEPTED"] = 1] = "ACCEPTED";
    FollowStatus[FollowStatus["REJECTED"] = 2] = "REJECTED";
})(FollowStatus || (exports.FollowStatus = FollowStatus = {}));
