import { Schema, model, type Document, type Types } from "mongoose";

export interface ISale extends Document {
  checkoutId: string;
  product: Types.ObjectId;
  itemName: string;
  quantityValue: number;
  quantityUnit: "kg" | "g" | "l" | "ml" | "nos";
  paymentMode: "CASH" | "UPI";
  costPrice: number;
  sellingPrice: number;
  totalPrice: number;
  soldAt: Date;
  owner: Types.ObjectId;
}

const saleSchema = new Schema<ISale>(
  {
    checkoutId: { type: String, required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    itemName: { type: String, required: true, trim: true },
    quantityValue: { type: Number, required: true, min: 0.01 },
    quantityUnit: { type: String, enum: ["kg", "g", "l", "ml", "nos"], required: true },
    paymentMode: { type: String, enum: ["CASH", "UPI"], required: true },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    soldAt: { type: Date, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const Sale = model<ISale>("Sale", saleSchema);
