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

type DatePreset = "TODAY" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH";

const getIstRange = (preset: DatePreset): { start: Date; end: Date } => {
  const now = new Date();
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  const mk = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
    new Date(Date.UTC(y, m, d, h - 5, min - 30, s, ms));

  const y = istNow.getFullYear();
  const m = istNow.getMonth();
  const d = istNow.getDate();
  const day = istNow.getDay();

  if (preset === "TODAY") return { start: mk(y, m, d), end: mk(y, m, d, 23, 59, 59, 999) };
  if (preset === "YESTERDAY") return { start: mk(y, m, d - 1), end: mk(y, m, d - 1, 23, 59, 59, 999) };
  if (preset === "THIS_WEEK") {
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return { start: mk(y, m, d + mondayOffset), end: mk(y, m, d, 23, 59, 59, 999) };
  }
  if (preset === "LAST_WEEK") {
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const startDay = d + mondayOffset - 7;
    return { start: mk(y, m, startDay), end: mk(y, m, startDay + 6, 23, 59, 59, 999) };
  }
  if (preset === "THIS_MONTH") return { start: mk(y, m, 1), end: mk(y, m, d, 23, 59, 59, 999) };
  return { start: mk(y, m - 1, 1), end: mk(y, m, 0, 23, 59, 59, 999) };
};

const getCheckoutKey = (sale: { checkoutId?: string; soldAt: Date; paymentMode: "CASH" | "UPI" }): string =>
  sale.checkoutId ?? `${sale.soldAt.toISOString()}::${sale.paymentMode}`;

export const resolvers = {
  Query: {
    me: (_: unknown, __: unknown, context: GraphQLContext) => context.user,
    sales: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      return Sale.find({ owner: user._id }).sort({ soldAt: -1 });
    },
    dashboardStats: async (
      _: unknown,
      args: { filter: { preset: DatePreset } },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const { start, end } = getIstRange(args.filter.preset);
      const sales = await Sale.find({ owner: user._id, soldAt: { $gte: start, $lte: end } }).sort({
        soldAt: -1
      });

      const transactionMap = new Map<
        string,
        {
          soldAt: Date;
          paymentMode: "CASH" | "UPI";
          totalPrice: number;
          items: Array<{ itemName: string }>;
        }
      >();
      for (const sale of sales) {
        const key = getCheckoutKey(sale);
        const prev = transactionMap.get(key) ?? {
          soldAt: sale.soldAt,
          paymentMode: sale.paymentMode,
          totalPrice: 0,
          items: []
        };
        prev.totalPrice += sale.totalPrice;
        prev.items.push({ itemName: sale.itemName });
        transactionMap.set(key, prev);
      }
      const transactions = Array.from(transactionMap.entries()).map(([id, transaction]) => ({ id, ...transaction }));

      const cashSales = transactions.filter((sale) => sale.paymentMode === "CASH");
      const upiSales = transactions.filter((sale) => sale.paymentMode === "UPI");
      const cashAmount = cashSales.reduce((sum, sale) => sum + sale.totalPrice, 0);
      const upiAmount = upiSales.reduce((sum, sale) => sum + sale.totalPrice, 0);
      const totalAmount = cashAmount + upiAmount;

      const itemMap = new Map<string, { totalAmount: number; checkoutIds: Set<string> }>();
      for (const sale of sales) {
        const prev = itemMap.get(sale.itemName) ?? { totalAmount: 0, checkoutIds: new Set<string>() };
        prev.totalAmount += sale.totalPrice;
        prev.checkoutIds.add(getCheckoutKey(sale));
        itemMap.set(sale.itemName, prev);
      }
      const topSellingItems = Array.from(itemMap.entries())
        .map(([itemName, stats]) => ({ itemName, totalAmount: stats.totalAmount, transactionCount: stats.checkoutIds.size }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5);

      const recentTransactions = transactions
        .sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime())
        .slice(0, 5)
        .map((transaction) => ({
          id: transaction.id,
          itemSummary: transaction.items.map((item) => item.itemName).join(", "),
          itemCount: transaction.items.length,
          totalPrice: transaction.totalPrice,
          paymentMode: transaction.paymentMode,
          soldAt: transaction.soldAt.toISOString()
        }));

      return {
        cashAmount,
        upiAmount,
        totalAmount,
        cashTransactions: cashSales.length,
        upiTransactions: upiSales.length,
        topSellingItems,
        recentTransactions
      };
    },
    categories: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      return Category.find({ owner: user._id }).sort({ name: 1 });
    },
    products: async (_: unknown, __: unknown, context: GraphQLContext) => {
      const user = requireAuth(context);
      return Product.find({ owner: user._id }).sort({ name: 1 });
    },
    searchProducts: async (_: unknown, args: { term: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const term = args.term.trim();
      if (!term) return [];
      return Product.find({
        owner: user._id,
        name: { $regex: escapeRegex(term), $options: "i" }
      })
        .sort({ name: 1 })
        .limit(10);
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
    createSales: async (
      _: unknown,
      args: {
        input: {
          items: Array<{
            productId: string;
            quantityValue: number;
            sellingPrice: number;
          }>;
          paymentMode: "CASH" | "UPI";
        };
      },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      if (!args.input.items.length) throw new GraphQLError("At least one item is required");
      const soldAt = new Date();
      const checkoutId = new Date().getTime().toString(36) + Math.random().toString(36).slice(2, 10);

      const saleDocs = await Promise.all(
        args.input.items.map(async (item) => {
          const product = await Product.findOne({ _id: item.productId, owner: user._id });
          if (!product) throw new GraphQLError("Selected product not found");
          if (item.quantityValue <= 0) throw new GraphQLError("Quantity must be greater than 0");
          if (item.sellingPrice <= 0) throw new GraphQLError("Selling price must be greater than 0");

          return {
            checkoutId,
            product: product._id,
            itemName: product.name,
            quantityValue: item.quantityValue,
            quantityUnit: product.quantityUnit,
            costPrice: product.sellingPrice,
            sellingPrice: item.sellingPrice,
            paymentMode: args.input.paymentMode,
            totalPrice: item.quantityValue * item.sellingPrice,
            soldAt,
            owner: user._id
          };
        })
      );

      return Sale.insertMany(saleDocs);
    },
    deleteSale: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      const user = requireAuth(context);
      const bySaleId = await Sale.findOne({ _id: args.id, owner: user._id });
      if (bySaleId) {
        if (bySaleId.checkoutId) {
          const deletedMany = await Sale.deleteMany({ checkoutId: bySaleId.checkoutId, owner: user._id });
          return deletedMany.deletedCount > 0;
        }
        const deletedOne = await Sale.findOneAndDelete({ _id: args.id, owner: user._id });
        return Boolean(deletedOne);
      }
      const deletedByCheckout = await Sale.deleteMany({ checkoutId: args.id, owner: user._id });
      return deletedByCheckout.deletedCount > 0;
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
    owner: async (sale: { owner: string }) => User.findById(sale.owner),
    product: async (sale: { product: string }) => Product.findById(sale.product)
  },
  Category: {
    owner: async (category: { owner: string }) => User.findById(category.owner)
  },
  Product: {
    owner: async (product: { owner: string }) => User.findById(product.owner),
    category: async (product: { category: string }) => Category.findById(product.category)
  }
};
