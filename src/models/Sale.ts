import { Schema, model, type Document, type Types } from "mongoose";

export interface ISale extends Document {
  itemName: string;
  category: "FRUIT" | "VEGETABLE";
  quantityKg: number;
  unitPrice: number;
  totalPrice: number;
  soldAt: Date;
  owner: Types.ObjectId;
}

const saleSchema = new Schema<ISale>(
  {
    itemName: { type: String, required: true, trim: true },
    category: { type: String, enum: ["FRUIT", "VEGETABLE"], required: true },
    quantityKg: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    soldAt: { type: Date, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const Sale = model<ISale>("Sale", saleSchema);
