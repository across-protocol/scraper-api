import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { customAlphabet } from "nanoid/async";
import { User } from "../model/user.entity";
import { UserNotFoundException } from "./exceptions";

@Injectable()
export class UserService {
  constructor(@InjectRepository(User) private userRepository: Repository<User>) {}

  public async createUserFromDiscordId({ discordId }: { discordId: string }) {
    let user = await this.userRepository.findOne({ where: { discordId } });

    if (!user) {
      const shortId = await this.createShortId();
      const uuid = this.createUUID();
      user = this.userRepository.create({ discordId, shortId, uuid });
      user = await this.userRepository.save(user);
    }

    return user;
  }

  public async getUserByAttributes(where: FindOptionsWhere<User>, validate = false, select?: (keyof User)[]) {
    const user = await this.userRepository.findOne({ where, select });

    if (!user && validate) {
      throw new UserNotFoundException();
    }

    return user;
  }

  public createShortId() {
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    return customAlphabet(alphabet, 16)();
  }

  public createUUID() {
    return uuidv4();
  }
}
