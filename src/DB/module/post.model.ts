import mongoose, { HydratedDocument } from "mongoose";
import { IPost } from "../../common/interface";

const userSchema = new mongoose.Schema<IPost>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, minLength: 2, maxLength: 100 },
    images: [String],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    shares: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
    autoIndex: true,
    strict: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export const PostModel = mongoose.models.Post || mongoose.model<IPost>("Post", userSchema);
export type HPost = HydratedDocument<IPost>;
