import { sign, SignOptions } from "jsonwebtoken";
import { configValues } from "../src/modules/configuration/index";

export function generateJwtForUser(user: { id: number; shortId: string; uuid: string }, jwtOptions?: SignOptions) {
  const payload = { id: user.id, uuid: user.uuid, shortId: user.shortId };
  return sign(payload, configValues().auth.jwtSecret, jwtOptions);
}
