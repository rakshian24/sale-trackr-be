export const typeDefs = `#graphql
  enum Category {
    FRUIT
    VEGETABLE
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Sale {
    id: ID!
    itemName: String!
    category: Category!
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
    email: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input CreateSaleInput {
    itemName: String!
    category: Category!
    quantityKg: Float!
    unitPrice: Float!
    soldAt: String!
  }

  type Query {
    me: User
    sales: [Sale!]!
    dashboardStats: DashboardStats!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    createSale(input: CreateSaleInput!): Sale!
    deleteSale(id: ID!): Boolean!
  }
`;
