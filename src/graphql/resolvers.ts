import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { Sale } from "../models/Sale";
import { User } from "../models/User";
import { createToken } from "../utils/auth";
import type { GraphQLContext } from "../types/context";

const requireAuth = (context: GraphQLContext) => {
  if (!context.user) {
    throw new GraphQLError("Unauthorized");
  }
  return context.user;
};

export const resolvers = {
  Query: {
    me: (_: unknown, __: unknown, context: GraphQLContext) => context.user,
    sales: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      return Sale.find({ owner: user._id }).sort({ soldAt: -1 });
    },
    dashboardStats: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      const sales = await Sale.find({ owner: user._id });

      const totalSalesAmount = sales.reduce((sum, sale) => sum + sale.totalPrice, 0);
      const fruitsAmount = sales
        .filter((sale) => sale.category === "FRUIT")
        .reduce((sum, sale) => sum + sale.totalPrice, 0);
      const vegetablesAmount = sales
        .filter((sale) => sale.category === "VEGETABLE")
        .reduce((sum, sale) => sum + sale.totalPrice, 0);

      return {
        totalSalesAmount,
        totalOrders: sales.length,
        fruitsAmount,
        vegetablesAmount
      };
    }
  },
  Mutation: {
    register: async (
      _: unknown,
      args: { input: { name: string; email: string; password: string } },
      context: GraphQLContext & { jwtSecret: string }
    ) => {
      const existingUser = await User.findOne({ email: args.input.email });
      if (existingUser) throw new GraphQLError("Email already exists");

      const password = await bcrypt.hash(args.input.password, 10);
      const user = await User.create({ ...args.input, password });
      const token = createToken(String(user._id), context.jwtSecret);
      return { token, user };
    },
    login: async (
      _: unknown,
      args: { input: { email: string; password: string } },
      context: GraphQLContext & { jwtSecret: string }
    ) => {
      const user = await User.findOne({ email: args.input.email });
      if (!user) throw new GraphQLError("Invalid credentials");

      const isValidPassword = await bcrypt.compare(args.input.password, user.password);
      if (!isValidPassword) throw new GraphQLError("Invalid credentials");

      const token = createToken(String(user._id), context.jwtSecret);
      return { token, user };
    },
    createSale: async (
      _: unknown,
      args: {
        input: {
          itemName: string;
          category: "FRUIT" | "VEGETABLE";
          quantityKg: number;
          unitPrice: number;
          soldAt: string;
        };
      },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const totalPrice = args.input.quantityKg * args.input.unitPrice;

      return Sale.create({
        ...args.input,
        soldAt: new Date(args.input.soldAt),
        totalPrice,
        owner: user._id
      });
    },
    deleteSale: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const deleted = await Sale.findOneAndDelete({ _id: args.id, owner: user._id });
      return Boolean(deleted);
    }
  },
  Sale: {
    owner: async (sale: { owner: string }) => User.findById(sale.owner)
  }
};
