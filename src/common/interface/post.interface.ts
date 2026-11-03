import mongoose from "mongoose";

export interface IPost {
  id?: string;
  _id?: mongoose.Schema.Types.ObjectId | string;
  userId: mongoose.Schema.Types.ObjectId | string;
  content: string;
  images?: string[];
  comments?: mongoose.Schema.Types.ObjectId[];
  likes?: {
    userId: mongoose.Schema.Types.ObjectId | string;
    createdAt: Date;
  };
  shares?: {
    userId: mongoose.Schema.Types.ObjectId | string;
    createdAt: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}
