import { Schema, model, type Document, type Types } from "mongoose";

export interface ICategory extends Document {
  name: string;
  owner: Types.ObjectId;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, owner: 1 }, { unique: true });

export const Category = model<ICategory>("Category", categorySchema);
