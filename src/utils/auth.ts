import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/User";

type TokenPayload = { userId: string };

export const createToken = (userId: string, jwtSecret: string): string =>
  jwt.sign({ userId }, jwtSecret, { expiresIn: "7d" });

export const getUserFromToken = async (
  authHeader: string | undefined,
  jwtSecret: string
): Promise<IUser | null> => {
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  try {
    const payload = jwt.verify(token, jwtSecret) as TokenPayload;
    return await User.findById(payload.userId);
  } catch {
    return null;
  }
};
