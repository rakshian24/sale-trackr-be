import "dotenv/config";
import cors from "cors";
import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { connectDb } from "./config/db";
import { typeDefs } from "./graphql/typeDefs";
import { resolvers } from "./graphql/resolvers";
import { getUserFromToken } from "./utils/auth";

const startServer = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI;
  const jwtSecret = process.env.JWT_SECRET;
  const port = Number(process.env.PORT ?? 4000);

  if (!mongoUri || !jwtSecret) {
    throw new Error("MONGO_URI and JWT_SECRET are required in .env");
  }

  await connectDb(mongoUri);

  const app = express();
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? "*", credentials: true }));
  app.use(express.json());

  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => {
        const user = await getUserFromToken(req.headers.authorization, jwtSecret);
        return { user, jwtSecret };
      }
    })
  );

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend running on http://localhost:${port}/graphql`);
  });
};

void startServer();
