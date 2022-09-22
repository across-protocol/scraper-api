import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { UserService } from "../../services/user.service";

@Controller("users")
export class UserController {
  constructor(private userService: UserService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  public async getUsersMe(@Req() req: any) {
    const id = req.user.id;
    const user = await this.userService.getUserByAttributes({ id }, true);

    return {
      user,
    };
  }
}
