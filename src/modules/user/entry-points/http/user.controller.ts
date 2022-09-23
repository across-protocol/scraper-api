import { Controller, Get, Post, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { UserService } from "../../services/user.service";
import { UserWalletService } from "../../services/user-wallet.service";
import { UsersWalletsBody } from "./dto";

@Controller("users")
export class UserController {
  constructor(private userService: UserService, private userWalletService: UserWalletService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  public async getUsersMe(@Req() req: any) {
    const id = req.user.id;
    const user = await this.userService.getUserByAttributes({ id }, true);

    return {
      user,
    };
  }

  @Post("me/wallets")
  @UseGuards(JwtAuthGuard)
  @ApiTags("users")
  public async postWallet(@Req() req: any, @Body() body: UsersWalletsBody) {
    const userId = req.user.id;
    const { walletAddress, signature, discordId } = body;

    const userWallet = await this.userWalletService.linkWallet({
      userId,
      walletAddress,
      signature,
      discordId,
    });

    return { userWallet };
  }

  @Patch("me/wallets")
  @UseGuards(JwtAuthGuard)
  @ApiTags("users")
  public async patchWallet(@Req() req: any, @Body() body: UsersWalletsBody) {
    const userId = req.user.id;
    const { walletAddress, signature, discordId } = body;

    const userWallet = await this.userWalletService.updateLinkedWallet({
      userId,
      walletAddress,
      signature,
      discordId,
    });

    return { userWallet };
  }
}
