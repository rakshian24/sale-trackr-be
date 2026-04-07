import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import { Sale } from "../models/Sale";
import { User } from "../models/User";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { createToken } from "../utils/auth";
import type { GraphQLContext } from "../types/context";

const requireAuth = (context: GraphQLContext) => {
  if (!context.user) {
    throw new GraphQLError("Unauthorized");
  }
  return context.user;
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateProductInput = (input: {
  name: string;
  pluNo: number;
  sellingPrice: number;
  quantityValue: number;
}) => {
  const trimmedName = input.name.trim();
  if (!trimmedName) throw new GraphQLError("Product name is required");
  if (trimmedName.length > 100) throw new GraphQLError("Product name cannot be longer than 100 characters");
  if (!Number.isFinite(input.pluNo) || input.pluNo <= 0 || input.pluNo > 500) {
    throw new GraphQLError("PLU number must be greater than 0 and less than or equal to 500");
  }
  if (!Number.isFinite(input.sellingPrice) || input.sellingPrice <= 0 || input.sellingPrice > 100000) {
    throw new GraphQLError("Selling price must be greater than 0 and less than or equal to 100000");
  }
  if (!Number.isFinite(input.quantityValue) || input.quantityValue <= 0 || input.quantityValue > 1000) {
    throw new GraphQLError("Quantity value must be greater than 0 and less than or equal to 1000");
  }
};

const validateCategoryName = (name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName) throw new GraphQLError("Category name is required");
  if (trimmedName.length > 100) throw new GraphQLError("Category name cannot be longer than 100 characters");
  return trimmedName;
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
    },
    categories: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      return Category.find({ owner: user._id }).sort({ name: 1 });
    },
    products: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      return Product.find({ owner: user._id }).sort({ name: 1 });
    }
  },
  Mutation: {
    register: async (
      _: unknown,
      args: { input: { name: string; shopName: string; email: string; password: string } },
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
    },
    createCategory: async (
      _: unknown,
      args: { input: { name: string } },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const trimmedName = validateCategoryName(args.input.name);
      const existingCategory = await Category.findOne({
        owner: user._id,
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" }
      });
      if (existingCategory) throw new GraphQLError("Category name already exists");
      return Category.create({ name: trimmedName, owner: user._id });
    },
    updateCategory: async (
      _: unknown,
      args: { id: string; input: { name: string } },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const trimmedName = validateCategoryName(args.input.name);
      const existingCategory = await Category.findOne({
        _id: { $ne: args.id },
        owner: user._id,
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" }
      });
      if (existingCategory) throw new GraphQLError("Category name already exists");
      const category = await Category.findOneAndUpdate(
        { _id: args.id, owner: user._id },
        { name: trimmedName },
        { new: true }
      );
      if (!category) throw new GraphQLError("Category not found");
      return category;
    },
    deleteCategory: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const deleted = await Category.findOneAndDelete({ _id: args.id, owner: user._id });
      if (!deleted) return false;
      await Product.deleteMany({ category: args.id, owner: user._id });
      return true;
    },
    createProduct: async (
      _: unknown,
      args: {
        input: {
          name: string;
          pluNo: number;
          sellingPrice: number;
          quantityValue: number;
          quantityUnit: "kg" | "g" | "l" | "ml" | "nos";
          categoryId: string;
        };
      },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const trimmedName = args.input.name.trim();
      validateProductInput(args.input);
      const category = await Category.findOne({ _id: args.input.categoryId, owner: user._id });
      if (!category) throw new GraphQLError("Category not found");
      const existingByName = await Product.findOne({
        owner: user._id,
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" }
      });
      if (existingByName) throw new GraphQLError("Product name already exists");
      const existingByPlu = await Product.findOne({
        owner: user._id,
        pluNo: args.input.pluNo
      });
      if (existingByPlu) throw new GraphQLError("PLU number already exists");
      return Product.create({
        name: trimmedName,
        pluNo: args.input.pluNo,
        sellingPrice: args.input.sellingPrice,
        quantityValue: args.input.quantityValue,
        quantityUnit: args.input.quantityUnit,
        category: args.input.categoryId,
        owner: user._id
      });
    },
    updateProduct: async (
      _: unknown,
      args: {
        id: string;
        input: {
          name: string;
          pluNo: number;
          sellingPrice: number;
          quantityValue: number;
          quantityUnit: "kg" | "g" | "l" | "ml" | "nos";
          categoryId: string;
        };
      },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const trimmedName = args.input.name.trim();
      validateProductInput(args.input);
      const category = await Category.findOne({ _id: args.input.categoryId, owner: user._id });
      if (!category) throw new GraphQLError("Category not found");
      const existingByName = await Product.findOne({
        _id: { $ne: args.id },
        owner: user._id,
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" }
      });
      if (existingByName) throw new GraphQLError("Product name already exists");
      const existingByPlu = await Product.findOne({
        _id: { $ne: args.id },
        owner: user._id,
        pluNo: args.input.pluNo
      });
      if (existingByPlu) throw new GraphQLError("PLU number already exists");
      const product = await Product.findOneAndUpdate(
        { _id: args.id, owner: user._id },
        {
          name: trimmedName,
          pluNo: args.input.pluNo,
          sellingPrice: args.input.sellingPrice,
          quantityValue: args.input.quantityValue,
          quantityUnit: args.input.quantityUnit,
          category: args.input.categoryId
        },
        { new: true }
      );
      if (!product) throw new GraphQLError("Product not found");
      return product;
    },
    deleteProduct: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const deleted = await Product.findOneAndDelete({ _id: args.id, owner: user._id });
      return Boolean(deleted);
    }
  },
  Sale: {
    owner: async (sale: { owner: string }) => User.findById(sale.owner)
  },
  Category: {
    owner: async (category: { owner: string }) => User.findById(category.owner)
  },
  Product: {
    owner: async (product: { owner: string }) => User.findById(product.owner),
    category: async (product: { category: string }) => Category.findById(product.category)
  }
};
