import { IUser } from "../models/User";

export type GraphQLContext = {
  user: IUser | null;
};
