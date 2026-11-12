import mongoose, { HydratedDocument } from "mongoose";
import { IComment } from "../../common/interface";

const commentSchema = new mongoose.Schema<IComment>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    content: { type: String, minLength: 2, maxLength: 100 },
    images: [String],
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
  } else {
    this.setQuery({
      ...query,
      deletedAt: { $exists: true, $ne: null },
    });
  }
});

export const CommentModel = mongoose.models.Comment || mongoose.model<IComment>("Comment", commentSchema);
export type HComment = HydratedDocument<IComment>;
