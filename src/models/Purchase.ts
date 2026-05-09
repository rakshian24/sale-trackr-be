import { Schema, model, type Document, type Types } from "mongoose";

export interface IPurchase extends Document {
  source: string;
  product: Types.ObjectId;
  productName: string;
  purchasedQuantity: number;
  quantityUnit: "kg" | "l" | "ml" | "nos" | "bunch";
  costPricePerUnit: number;
  sellingPricePerUnit: number;
  totalCost: number;
  purchasedAt: Date;
  owner: Types.ObjectId;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    source: { type: String, required: true, trim: true, maxlength: 120 },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    purchasedQuantity: { type: Number, required: true, min: 0.001, max: 100000 },
    quantityUnit: {
      type: String,
      enum: ["kg", "l", "ml", "nos", "bunch"],
      required: true,
    },
    costPricePerUnit: { type: Number, required: true, min: 0.001, max: 100000 },
    sellingPricePerUnit: { type: Number, required: true, min: 0.001, max: 100000 },
    totalCost: { type: Number, required: true, min: 0.001, max: 100000000 },
    purchasedAt: { type: Date, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

purchaseSchema.index({ owner: 1, purchasedAt: -1 });

export const Purchase = model<IPurchase>("Purchase", purchaseSchema);
