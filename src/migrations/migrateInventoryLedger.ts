import mongoose from "mongoose";
import { Sale } from "../models/Sale";
import { Purchase } from "../models/Purchase";
import { Product } from "../models/Product";
import { SalePurchaseAllocation } from "../models/SalePurchaseAllocation";
import {
  applyFifoSlices,
  planFifoConsumption,
  refreshProductOnHand,
  recordSaleAllocations,
  weightedAverageCost,
} from "../services/inventoryFifo";

/**
 * Normalize `quantityRemaining` on purchases and, when there are sales but no
 * allocation docs yet, replay sales chronologically using FIFO so stock matches history.
 */
export async function migrateInventoryLedger(): Promise<void> {
  await Purchase.collection.updateMany(
    {},
    [
      {
        $set: {
          quantityRemaining: { $ifNull: ["$quantityRemaining", "$purchasedQuantity"] },
        },
      },
    ],
  );

  const allocationCount = await SalePurchaseAllocation.countDocuments();
  const saleCount = await Sale.estimatedDocumentCount();

  if (allocationCount === 0 && saleCount > 0) {
    const sales = await Sale.find({})
      .sort({ soldAt: 1, _id: 1 })
      .select("_id owner product quantityUnit quantityValue costPrice")
      .lean();

    // eslint-disable-next-line no-console
    console.log(
      `Inventory migration: replaying ${sales.length} sale line(s) into FIFO allocations...`,
    );

    for (const sale of sales) {
      const slices = await planFifoConsumption(
        sale.owner as mongoose.Types.ObjectId,
        sale.product as mongoose.Types.ObjectId,
        sale.quantityUnit,
        sale.quantityValue,
        null,
      );
      const weighted = weightedAverageCost(slices);

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await Sale.findOneAndUpdate(
            { _id: sale._id },
            { $set: { costPrice: weighted } },
            { session },
          );
          await applyFifoSlices(slices, sale.owner as mongoose.Types.ObjectId, session);
          await recordSaleAllocations(
            sale._id as mongoose.Types.ObjectId,
            sale.owner as mongoose.Types.ObjectId,
            slices,
            session,
          );
        });
      } finally {
        await session.endSession();
      }
    }

    // eslint-disable-next-line no-console
    console.log("FIFO replay complete.");
  }

  if (allocationCount === 0) {
    const products = await Product.find({}).select("_id owner").lean();
    for (const p of products) {
      await refreshProductOnHand(p.owner as mongoose.Types.ObjectId, String(p._id), null);
    }
  }
}
