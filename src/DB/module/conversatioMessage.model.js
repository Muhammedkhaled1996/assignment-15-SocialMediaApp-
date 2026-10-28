import { Schema, model, Types } from "mongoose";

const conversationMessageSchema = new Schema(
  {
    conversationId: {
      type: Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: function () {
        return this.attachments?.length > 0 ? false : true;
      },
      minLength: 2,
      maxLength: 50000,
    },
    attachments: [String],
  },
  { timestamps: true },
);

export const ConversationMessageModel = model("ConversationMessage", conversationMessageSchema);
