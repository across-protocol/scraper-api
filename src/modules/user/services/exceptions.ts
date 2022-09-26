import { HttpException, HttpStatus } from "@nestjs/common";

export class UserNotFoundException extends HttpException {
  constructor() {
    super(
      {
        error: UserNotFoundException.name,
        message: "User not found",
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class WalletNotFoundException extends HttpException {
  constructor(userId: number) {
    super(
      {
        error: WalletNotFoundException.name,
        message: `Wallet for user id ${userId} not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidSignatureException extends HttpException {
  constructor() {
    super(
      {
        error: InvalidSignatureException.name,
        message: "Invalid signature",
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class WalletAlreadyLinkedException extends HttpException {
  constructor() {
    super(
      {
        error: WalletAlreadyLinkedException.name,
        message: "Wallet is already linked",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
