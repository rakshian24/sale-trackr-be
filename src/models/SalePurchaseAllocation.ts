import { Schema, model, type Document, type Types } from "mongoose";

export interface ISalePurchaseAllocation extends Document {
  sale: Types.ObjectId;
  purchase: Types.ObjectId;
  quantityAllocated: number;
  owner: Types.ObjectId;
}

const salePurchaseAllocationSchema = new Schema<ISalePurchaseAllocation>(
  {
    sale: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    purchase: { type: Schema.Types.ObjectId, ref: "Purchase", required: true },
    quantityAllocated: { type: Number, required: true, min: 0.001, max: 100000 },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

salePurchaseAllocationSchema.index({ owner: 1, sale: 1 });
salePurchaseAllocationSchema.index({ owner: 1, purchase: 1 });

export const SalePurchaseAllocation = model<ISalePurchaseAllocation>(
  "SalePurchaseAllocation",
  salePurchaseAllocationSchema,
);
