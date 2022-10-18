import { HttpException, HttpStatus } from "@nestjs/common";

export class ProcessCommunityRewardsFileException extends HttpException {
  constructor() {
    super(
      {
        error: ProcessCommunityRewardsFileException.name,
        message: "Could not process community rewards JSON file",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ProcessWalletRewardsFileException extends HttpException {
  constructor() {
    super(
      {
        error: ProcessWalletRewardsFileException.name,
        message: "Could not process wallets rewards JSON file",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DuplicatedMerkleDistributorWindowException extends HttpException {
  constructor() {
    super(
      {
        error: DuplicatedMerkleDistributorWindowException.name,
        message: "The window index already exists in the database",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
