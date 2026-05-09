import mongoose from "mongoose";
import { migrateInventoryLedger } from "../migrations/migrateInventoryLedger";

export const connectDb = async (mongoUri: string): Promise<void> => {
  await mongoose.connect(mongoUri);
  // eslint-disable-next-line no-console
  console.log("MongoDB connected");
  await migrateInventoryLedger();
};
