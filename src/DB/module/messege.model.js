import mongoose from "mongoose";
import { connectStatusEnum } from "../../common/enum/viewSender.enum.js";

const messegeSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: function () {
        return this.attachments?.length > 0 ? false : true;
      },
      minLength: 2,
      maxLength: 50000,
    },
    attachments: [String],
    receiverId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    connectStatus: {
      type: Number,
      enum: Object.values(connectStatusEnum),
    },
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

export const MessagesModel = mongoose.models.Messages || mongoose.model("Messages", messegeSchema);
