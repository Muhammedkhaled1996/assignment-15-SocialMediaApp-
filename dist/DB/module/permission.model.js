"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const permissionSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    module: { type: String, required: true, lowercase: true, trim: true, index: true },
    action: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    isSystem: { type: Boolean, default: true },
}, { timestamps: true, strict: true });
permissionSchema.index({ module: 1, action: 1 });
exports.PermissionModel = mongoose_1.default.models.Permission ||
    mongoose_1.default.model("Permission", permissionSchema);
