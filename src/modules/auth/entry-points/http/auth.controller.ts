import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { UserService } from "src/modules/user/services/user.service";
import { AuthService } from "../../services/auth.service";
import { DiscordAuthGuard } from "./discord.guard";

@Controller("auth")
export class AuthController {
  constructor(private userService: UserService, private authService: AuthService) {}

  @Get("discord")
  @UseGuards(DiscordAuthGuard)
  async getUserFromDiscordLogin(@Req() req: any): Promise<any> {
    const user = await this.userService.createOrUpdateUserFromDiscord({
      discordId: req.user.id,
      discordAvatar: req.user.avatar,
      discordName: req.user.name,
    });
    const jwt = this.authService.generateJwtForUser(user);

    return { user, jwt };
  }
}
