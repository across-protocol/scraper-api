import { Controller, Get, Post, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { utils } from "ethers";

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

  @Get("me/wallets")
  @UseGuards(JwtAuthGuard)
  @ApiTags("users")
  public async getWallet(@Req() req: any) {
    const userId = req.user.id;

    const { walletAddress } = await this.userWalletService.getWalletByUserId(userId);

    return { walletAddress };
  }

  @Post("me/wallets")
  @UseGuards(JwtAuthGuard)
  @ApiTags("users")
  public async postWallet(@Req() req: any, @Body() body: UsersWalletsBody) {
    const userId = req.user.id;
    const { walletAddress, signature, discordId } = body;

    const linkedUserWallet = await this.userWalletService.linkWallet({
      userId,
      walletAddress: utils.getAddress(walletAddress),
      signature,
      discordId,
    });

    return { walletAddress: linkedUserWallet.walletAddress };
  }

  @Patch("me/wallets")
  @UseGuards(JwtAuthGuard)
  @ApiTags("users")
  public async patchWallet(@Req() req: any, @Body() body: UsersWalletsBody) {
    const userId = req.user.id;
    const { walletAddress, signature, discordId } = body;

    const updatedUserWallet = await this.userWalletService.updateLinkedWallet({
      userId,
      walletAddress: utils.getAddress(walletAddress),
      signature,
      discordId,
    });

    return { walletAddress: updatedUserWallet.walletAddress };
  }
}
