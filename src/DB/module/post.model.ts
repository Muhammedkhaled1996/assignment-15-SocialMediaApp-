import mongoose, { HydratedDocument } from "mongoose";
import { IPost } from "../../common/interface";

const postSchema = new mongoose.Schema<IPost>(
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
  } else {
    this.setQuery({
      ...query,
      deletedAt: { $exists: true, $ne: null },
    });
  }
});

export const PostModel = mongoose.models.Post || mongoose.model<IPost>("Post", postSchema);
export type HPost = HydratedDocument<IPost>;
