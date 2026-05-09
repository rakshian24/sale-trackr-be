export const typeDefs = `#graphql
  enum SaleCategory {
    FRUIT
    VEGETABLE
  }

  enum QuantityUnit {
    kg
    g
    l
    ml
    nos
    bunch
  }

  enum PaymentMode {
    CASH
    UPI
  }

  enum DatePreset {
    TODAY
    YESTERDAY
    THIS_WEEK
    LAST_WEEK
    THIS_MONTH
    LAST_MONTH
  }

  type User {
    id: ID!
    name: String!
    shopName: String!
    email: String!
  }

  type Category {
    id: ID!
    name: String!
    owner: User!
  }

  type Product {
    id: ID!
    name: String!
    pluNo: Int!
    costPrice: Float!
    sellingPrice: Float!
    profit: Float!
    quantityValue: Float!
    quantityUnit: QuantityUnit!
    category: Category!
    owner: User!
  }

  type Sale {
    id: ID!
    product: Product!
    itemName: String!
    quantityValue: Float!
    quantityUnit: QuantityUnit!
    costPrice: Float!
    sellingPrice: Float!
    paymentMode: PaymentMode!
    totalPrice: Float!
    soldAt: String!
    owner: User!
  }

  type Purchase {
    id: ID!
    source: String!
    product: Product!
    productName: String!
    purchasedQuantity: Float!
    quantityUnit: QuantityUnit!
    costPricePerUnit: Float!
    sellingPricePerUnit: Float!
    totalCost: Float!
    purchasedAt: String!
    owner: User!
  }

  type TopSellingItem {
    itemName: String!
    totalAmount: Float!
    transactionCount: Int!
  }

  type RecentTransaction {
    id: ID!
    itemSummary: String!
    itemCount: Int!
    totalPrice: Float!
    paymentMode: PaymentMode!
    soldAt: String!
  }

  type DashboardStats {
    cashAmount: Float!
    upiAmount: Float!
    totalAmount: Float!
    cashTransactions: Int!
    upiTransactions: Int!
    topSellingItems: [TopSellingItem!]!
    topTransactions: [RecentTransaction!]!
    recentTransactions: [RecentTransaction!]!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input RegisterInput {
    name: String!
    shopName: String!
    email: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input SaleLineInput {
    productId: ID!
    quantityValue: Float!
    sellingPrice: Float!
  }

  input CreateSalesInput {
    items: [SaleLineInput!]!
    paymentMode: PaymentMode!
  }

  input DashboardFilterInput {
    preset: DatePreset!
  }

  input CreateCategoryInput {
    name: String!
  }

  input UpdateCategoryInput {
    name: String!
  }

  input CreateProductInput {
    name: String!
    pluNo: Int!
    categoryName: String
  }

  input UpdateProductInput {
    name: String!
    pluNo: Int!
  }

  input CreatePurchaseInput {
    purchasedAt: String!
    source: String!
    productId: ID!
    purchasedQuantity: Float!
    quantityUnit: QuantityUnit!
    costPricePerUnit: Float!
    sellingPricePerUnit: Float!
  }

  input UpdatePurchaseInput {
    purchasedAt: String!
    source: String!
    productId: ID!
    purchasedQuantity: Float!
    quantityUnit: QuantityUnit!
    costPricePerUnit: Float!
    sellingPricePerUnit: Float!
  }

  type Query {
    me: User
    sales: [Sale!]!
    dashboardStats(filter: DashboardFilterInput!): DashboardStats!
    categories: [Category!]!
    products: [Product!]!
    searchProducts(term: String!): [Product!]!
    purchases: [Purchase!]!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    createSales(input: CreateSalesInput!): [Sale!]!
    deleteSale(id: ID!): Boolean!
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(id: ID!): Boolean!
    createPurchase(input: CreatePurchaseInput!): Purchase!
    updatePurchase(id: ID!, input: UpdatePurchaseInput!): Purchase!
    deletePurchase(id: ID!): Boolean!
  }
`;
