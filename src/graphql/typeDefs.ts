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
    sellingPrice: Float!
    quantityValue: Float!
    quantityUnit: QuantityUnit!
    category: Category!
    owner: User!
  }

  type Sale {
    id: ID!
    itemName: String!
    category: SaleCategory!
    quantityKg: Float!
    unitPrice: Float!
    totalPrice: Float!
    soldAt: String!
    owner: User!
  }

  type DashboardStats {
    totalSalesAmount: Float!
    totalOrders: Int!
    fruitsAmount: Float!
    vegetablesAmount: Float!
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

  input CreateSaleInput {
    itemName: String!
    category: SaleCategory!
    quantityKg: Float!
    unitPrice: Float!
    soldAt: String!
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
    sellingPrice: Float!
    quantityValue: Float!
    quantityUnit: QuantityUnit!
    categoryId: ID!
  }

  input UpdateProductInput {
    name: String!
    pluNo: Int!
    sellingPrice: Float!
    quantityValue: Float!
    quantityUnit: QuantityUnit!
    categoryId: ID!
  }

  type Query {
    me: User
    sales: [Sale!]!
    dashboardStats: DashboardStats!
    categories: [Category!]!
    products: [Product!]!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    createSale(input: CreateSaleInput!): Sale!
    deleteSale(id: ID!): Boolean!
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    deleteProduct(id: ID!): Boolean!
  }
`;
