import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { customAlphabet } from "nanoid";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { User } from "../../model/user.entity";

@Injectable()
export class UserFixture {
  public constructor(@InjectRepository(User) private userRepository: Repository<User>) {}

  public insertUser(args: Partial<User> = {}) {
    const user = this.userRepository.create(this.mockUserEntity(args));
    return this.userRepository.save(user);
  }

  public mockUserEntity(overrides: Partial<User> = {}) {
    return {
      discordAvatar: "https://picsum.photos/200",
      discordId: "1",
      discordName: "name",
      shortId: this.createShortId(),
      uuid: this.createUUID(),
      ...overrides,
    };
  }

  public deleteAllUsers() {
    return this.userRepository.query(`truncate table "user" restart identity cascade`);
  }

  public createShortId() {
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    return customAlphabet(alphabet, 16)();
  }

  public createUUID() {
    return uuidv4();
  }
}
