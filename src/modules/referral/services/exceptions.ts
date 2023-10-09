import { HttpException, HttpStatus } from "@nestjs/common";

export class WindowAlreadySetException extends HttpException {
  constructor() {
    super(
      {
        error: WindowAlreadySetException.name,
        message: "Window is already set",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class InvalidReferralRewardsWindowJobException extends HttpException {
  constructor(message: string) {
    super(
      {
        error: InvalidReferralRewardsWindowJobException.name,
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ReferralRewardsWindowJobNotFoundException extends HttpException {
  constructor(id: number) {
    super(
      {
        error: ReferralRewardsWindowJobNotFoundException.name,
        message: `Job with id ${id} not found.`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
