import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../../../auth/entry-points/http/optional-jwt.";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { Role, Roles, RolesGuard } from "../../../auth/entry-points/http/roles";
import { AirdropService } from "../../services/airdrop-service";
import {
  EditWalletRewardsBody,
  GetAirdropRewardsQuery,
  GetAirdropRewardsResponse,
  GetEtlMerkleDistributorRecipientsQuery,
  GetMerkleDistributorProofQuery,
  GetMerkleDistributorProofsQuery,
} from "./dto";

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

  @Get("welcome-traveller-eligible")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiTags("airdrop")
  @ApiBearerAuth()
  async getWelcomeTravellerEligibleWallets() {
    return this.airdropService.getWelcomeTravellerEligibleWallets();
  }

  @Get("community-rewards-eligible")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiTags("airdrop")
  @ApiBearerAuth()
  async getCommunityRewardsEligibleWallets() {
    return this.airdropService.getCommunityRewardsEligibleWallets();
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
  @ApiTags("airdrop")
  @ApiBearerAuth()
  async feedWalletRewards(
    @UploadedFiles() files: { walletRewards?: Express.Multer.File[]; communityRewards?: Express.Multer.File[] },
  ) {
    return this.airdropService.processUploadedRewardsFiles({
      communityRewardsFile: files?.communityRewards?.[0],
      walletRewardsFile: files?.walletRewards?.[0],
    });
  }

  @Post("upload/merkle-distributor-recipients")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 200 * 1024 * 1024 },
      dest: "./uploads",
    }),
  )
  @ApiTags("airdrop")
  @ApiBearerAuth()
  uploadMerkleDistributorRecipients(@UploadedFile() file: Express.Multer.File) {
    return this.airdropService.processMerkleDistributorRecipientsFile(file);
  }

  @Get("merkle-distributor-proof")
  @ApiTags("airdrop")
  getMerkleDistributorProof(@Query() query: GetMerkleDistributorProofQuery) {
    return this.airdropService.getMerkleDistributorProof(query);
  }

  @Get("merkle-distributor-proofs")
  @ApiTags("airdrop")
  getMerkleDistributorProofs(@Query() query: GetMerkleDistributorProofsQuery) {
    return this.airdropService.getMerkleDistributorProofs(query);
  }

  @Get("etl/merkle-distributor-recipients")
  @ApiTags("etl")
  getEtlMerkleDistributorRecipients(@Query() query: GetEtlMerkleDistributorRecipientsQuery) {
    return this.airdropService.getEtlMerkleDistributorRecipients(query);
  }
}
