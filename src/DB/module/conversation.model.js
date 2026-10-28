import { Schema, model, Types } from "mongoose";

const conversationSchema = new Schema(
  {
    originalMessageId: {
      type: Types.ObjectId,
      ref: "Messages",
      required: true,
      unique: true, // لضمان عدم إنشاء أكثر من محادثة لنفس الرسالة
    },
    participants: [
      {
        type: Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  { timestamps: true }
);

export const ConversationModel = model("Conversation", conversationSchema);