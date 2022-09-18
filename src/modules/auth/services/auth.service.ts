import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { User } from "../../user/model/user.entity";

@Injectable()
export class AuthService {
  public constructor(private jwtService: JwtService) {}

  public generateJwtForUser(user: User) {
    const payload = { id: user.id, uuid: user.uuid, shortId: user.shortId };
    return this.jwtService.sign(payload);
  }
}
