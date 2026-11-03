import mongoose from "mongoose";



export interface IComment {
  id?: string;
  _id?: mongoose.Schema.Types.ObjectId | string;
  userId: mongoose.Schema.Types.ObjectId | string;
  postId: mongoose.Schema.Types.ObjectId | string;
  content: string;
  images?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}
