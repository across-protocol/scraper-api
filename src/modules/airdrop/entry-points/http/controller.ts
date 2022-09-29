import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../../../auth/entry-points/http/optional-jwt.";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { Role, Roles, RolesGuard } from "../../../auth/entry-points/http/roles";
import { AirdropService } from "../../services/airdrop-service";
import { EditWalletRewardsBody, GetAirdropRewardsQuery, GetAirdropRewardsResponse } from "./dto";

@Controller("airdrop")
export class AirdropController {
  constructor(private airdropService: AirdropService) {}

  @Get("rewards")
  @ApiResponse({ type: GetAirdropRewardsResponse })
  @ApiTags("airdrop")
  @UseGuards(OptionalJwtAuthGuard)
  getAirdropRewards(@Req() req: any, @Query() query: GetAirdropRewardsQuery) {
    return this.airdropService.getRewards(query.address, req.user.id);
  }

  @Patch("rewards/wallet-rewards")
  @ApiTags("airdrop")
  editWalletRewards(@Body() body: EditWalletRewardsBody) {
    return this.airdropService.editWalletRewards(body);
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
