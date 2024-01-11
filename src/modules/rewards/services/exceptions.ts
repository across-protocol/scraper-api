import { HttpException, HttpStatus } from "@nestjs/common";

export class InvalidRewardsWindowJobException extends HttpException {
  constructor(message: string) {
    super(
      {
        error: InvalidRewardsWindowJobException.name,
        message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

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

export class RewardsWindowJobNotFoundException extends HttpException {
  constructor(id: number) {
    super(
      {
        error: RewardsWindowJobNotFoundException.name,
        message: `Job with id ${id} not found.`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
