"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const postSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, minLength: 2, maxLength: 100 },
    images: [String],
    comments: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Comment" }],
    likes: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" }],
    shares: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" }],
    deletedAt: { type: Date },
}, {
    timestamps: true,
    autoIndex: true,
    strict: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
postSchema.pre(["find", "findOne"], function () {
    const query = this.getFilter();
    if (query.paranoid != false) {
        this.setQuery({ ...query, deletedAt: { $exists: false } });
    }
});
postSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
    const query = this.getFilter();
    if (query.paranoid != false) {
        this.setQuery({ ...query, deletedAt: { $exists: false } });
    }
});
postSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], function () {
    const query = { ...this.getFilter() };
    if (query.force) {
        this.setQuery(query);
    }
    else {
        this.setQuery({
            ...query,
            deletedAt: { $exists: true, $ne: null },
        });
    }
});
exports.PostModel = mongoose_1.default.models.Post || mongoose_1.default.model("Post", postSchema);
