import { Controller, Get, Post, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { UserService } from "../../services/user.service";
import { WalletService } from "../../services/wallet.service";
import { UsersWalletsBody } from "./dto";

@Controller("users")
export class UserController {
  constructor(private userService: UserService, private walletService: WalletService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  public async getUsersMe(@Req() req: any) {
    const id = req.user.id;
    const user = await this.userService.getUserByAttributes({ id }, true);

    return {
      user,
    };
  }

  @Post("wallets")
  @UseGuards(JwtAuthGuard)
  @ApiTags("users")
  public async postWallet(@Req() req: any, @Body() body: UsersWalletsBody) {
    const userId = req.user.id;
    const { walletAddress, signature, discordId } = body;

    this.walletService.verifySignedDiscordId({
      signature,
      discordIdMessage: discordId,
      walletAddress,
    });

    await this.walletService.assertUserExists(userId);

    const wallet = await this.walletService.upsertWallet({
      userId,
      walletAddress,
    });

    return {
      wallet,
    };
  }

  @Patch("wallets")
  @UseGuards(JwtAuthGuard)
  @ApiTags("users")
  public async patchWallet(@Req() req: any, @Body() body: UsersWalletsBody) {
    const userId = req.user.id;
    const { walletAddress, signature, discordId } = body;

    this.walletService.verifySignedDiscordId({
      signature,
      discordIdMessage: discordId,
      walletAddress,
    });

    await this.walletService.assertWalletForUserExists(userId);

    const wallet = await this.walletService.upsertWallet({
      userId,
      walletAddress,
    });

    return {
      wallet,
    };
  }
}
