import mongoose, { type ClientSession, type Types } from "mongoose";
import { GraphQLError } from "graphql";
import { Product } from "../models/Product";
import { Purchase } from "../models/Purchase";
import { SalePurchaseAllocation } from "../models/SalePurchaseAllocation";

export type FifoSlice = {
  purchaseId: Types.ObjectId;
  quantity: number;
  costPricePerUnit: number;
};

const QTY_EPS = 1e-6;

export async function refreshProductOnHand(
  ownerId: Types.ObjectId,
  productId: string,
  session?: ClientSession | null,
): Promise<void> {
  let productQ = Product.findOne({ _id: productId, owner: ownerId }).select("quantityUnit");
  if (session) productQ = productQ.session(session);
  const product = await productQ.lean();
  if (!product) return;

  const match: Record<string, unknown> = {
    owner: ownerId,
    product: new mongoose.Types.ObjectId(productId),
    quantityUnit: product.quantityUnit,
  };

  let aggPipe = Purchase.aggregate<{ total: number }>([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$quantityRemaining" } } },
  ]);
  if (session) aggPipe = aggPipe.session(session);
  const agg = await aggPipe;

  const onHand = agg[0]?.total ?? 0;
  await Product.findOneAndUpdate(
    { _id: productId, owner: ownerId },
    { quantityValue: Math.max(0, onHand) },
    { session: session ?? undefined },
  );
}

/** Plan FIFO layers (oldest `purchasedAt` first). Does not write. */
export async function planFifoConsumption(
  ownerId: Types.ObjectId,
  productId: Types.ObjectId,
  quantityUnit: string,
  quantityNeeded: number,
  session: ClientSession | null,
): Promise<FifoSlice[]> {
  if (quantityNeeded <= 0) throw new GraphQLError("Quantity must be greater than 0");

  let batchQuery = Purchase.find({
    owner: ownerId,
    product: productId,
    quantityUnit,
    quantityRemaining: { $gt: QTY_EPS },
  }).sort({ purchasedAt: 1, _id: 1 });
  if (session) batchQuery = batchQuery.session(session);
  const batches = await batchQuery.lean();

  const slices: FifoSlice[] = [];
  let need = quantityNeeded;

  for (const b of batches) {
    if (need <= QTY_EPS) break;
    const avail = b.quantityRemaining ?? 0;
    if (avail <= QTY_EPS) continue;
    const take = Math.min(avail, need);
    slices.push({
      purchaseId: b._id,
      quantity: take,
      costPricePerUnit: b.costPricePerUnit,
    });
    need -= take;
  }

  if (need > QTY_EPS) {
    throw new GraphQLError(
      "Insufficient stock for one or more items. Record a purchase or reduce quantity.",
    );
  }

  return slices;
}

export function weightedAverageCost(slices: FifoSlice[]): number {
  if (!slices.length) return 0;
  let qty = 0;
  let costSum = 0;
  for (const s of slices) {
    qty += s.quantity;
    costSum += s.quantity * s.costPricePerUnit;
  }
  if (qty <= QTY_EPS) return 0;
  return costSum / qty;
}

export async function applyFifoSlices(
  slices: FifoSlice[],
  ownerId: Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  for (const s of slices) {
    const updated = await Purchase.findOneAndUpdate(
      {
        _id: s.purchaseId,
        owner: ownerId,
        quantityRemaining: { $gte: s.quantity - QTY_EPS },
      },
      { $inc: { quantityRemaining: -s.quantity } },
      { session, new: false },
    ).lean();
    if (!updated) {
      throw new GraphQLError("Stock changed while completing the sale. Please try again.");
    }
  }
}

export async function recordSaleAllocations(
  saleId: Types.ObjectId,
  ownerId: Types.ObjectId,
  slices: FifoSlice[],
  session: ClientSession,
): Promise<void> {
  if (!slices.length) return;
  await SalePurchaseAllocation.insertMany(
    slices.map((s) => ({
      sale: saleId,
      purchase: s.purchaseId,
      quantityAllocated: s.quantity,
      owner: ownerId,
    })),
    { session },
  );
}

export async function rollbackAllocationsForSales(
  ownerId: Types.ObjectId,
  saleIds: Types.ObjectId[],
  session: ClientSession,
): Promise<void> {
  if (!saleIds.length) return;

  const allocations = await SalePurchaseAllocation.find({
    owner: ownerId,
    sale: { $in: saleIds },
  })
    .session(session)
    .lean();

  for (const a of allocations) {
    await Purchase.findOneAndUpdate(
      { _id: a.purchase, owner: ownerId },
      { $inc: { quantityRemaining: a.quantityAllocated } },
      { session },
    );
  }

  await SalePurchaseAllocation.deleteMany({
    owner: ownerId,
    sale: { $in: saleIds },
  }).session(session);
}
