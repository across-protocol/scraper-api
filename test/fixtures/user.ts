import { User } from "../../src/modules/user/model/user.entity";

export function mockUserEntity(overrides?: Partial<User>): User {
  return {
    id: Math.floor(Date.now() / 1000),
    shortId: "shortId",
    uuid: "uuid",
    discordId: "discordId",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
