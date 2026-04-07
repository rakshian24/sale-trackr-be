import { Schema, model, type Document, type Types } from "mongoose";

export interface IProduct extends Document {
  name: string;
  pluNo: number;
  costPrice: number;
  sellingPrice: number;
  quantityValue: number;
  quantityUnit: "kg" | "g" | "l" | "ml" | "nos";
  category: Types.ObjectId;
  owner: Types.ObjectId;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    pluNo: { type: Number, required: true, min: 1, max: 500 },
    costPrice: { type: Number, required: true, min: 0.001, max: 100000 },
    sellingPrice: { type: Number, required: true, min: 0.001, max: 100000 },
    quantityValue: { type: Number, required: true, min: 0.001, max: 1000 },
    quantityUnit: { type: String, enum: ["kg", "g", "l", "ml", "nos"], required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

productSchema.index({ pluNo: 1, owner: 1 }, { unique: true });
productSchema.index({ name: 1, owner: 1 }, { unique: true });

export const Product = model<IProduct>("Product", productSchema);
