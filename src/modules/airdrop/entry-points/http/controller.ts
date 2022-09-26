import { Controller, Get, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { Role, Roles, RolesGuard } from "../../../auth/entry-points/http/roles";
import { AirdropService } from "../../services/airdrop-service";
import { GetAirdropRewardsQuery, GetAirdropRewardsResponse } from "./dto";

@Controller("airdrop")
export class AirdropController {
  constructor(private airdropService: AirdropService) {}

  @Get("rewards")
  @ApiResponse({ type: GetAirdropRewardsResponse })
  @ApiTags("airdrop")
  getAirdropRewards(@Query() query: GetAirdropRewardsQuery) {
    return this.airdropService.getRewards(query.address);
  }

  @Post("upload/rewards")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "walletRewards", maxCount: 1 },
        { name: "communityRewards", maxCount: 1 },
      ],
      {
        limits: { fileSize: 50 * 1024 * 1024 },
        dest: "./uploads",
      },
    ),
  )
  async feedWalletRewards(
    @UploadedFiles() files: { walletRewards?: Express.Multer.File[]; communityRewards?: Express.Multer.File[] },
  ) {
    return this.airdropService.processUploadedRewardsFiles({
      communityRewardsFile: files.communityRewards[0],
      walletRewardsFile: files.walletRewards[0],
    });
  }
}
