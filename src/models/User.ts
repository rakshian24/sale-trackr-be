import { Schema, model, type Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  shopName: string;
  email: string;
  password: string;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    shopName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
