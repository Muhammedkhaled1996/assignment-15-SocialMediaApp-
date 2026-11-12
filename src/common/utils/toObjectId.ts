import mongoose from "mongoose";

export const toObjectId = (id: string) => {
  return mongoose.Types.ObjectId.createFromHexString(id);
};
