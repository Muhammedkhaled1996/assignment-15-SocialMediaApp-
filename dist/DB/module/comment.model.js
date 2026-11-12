"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const commentSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Post", required: true },
    content: { type: String, minLength: 2, maxLength: 100 },
    images: [String],
    deletedAt: { type: Date },
}, {
    timestamps: true,
    autoIndex: true,
    strict: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
commentSchema.pre(["find", "findOne"], function () {
    const query = this.getFilter();
    if (query.paranoid != false) {
        this.setQuery({ ...query, deletedAt: { $exists: false } });
    }
});
commentSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
    const query = this.getFilter();
    if (query.paranoid != false) {
        this.setQuery({ ...query, deletedAt: { $exists: false } });
    }
});
commentSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], function () {
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
exports.CommentModel = mongoose_1.default.models.Comment || mongoose_1.default.model("Comment", commentSchema);
