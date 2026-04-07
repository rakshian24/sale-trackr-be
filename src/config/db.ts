import mongoose from "mongoose";

export const connectDb = async (mongoUri: string): Promise<void> => {
  await mongoose.connect(mongoUri);
  // eslint-disable-next-line no-console
  console.log("MongoDB connected");
};
