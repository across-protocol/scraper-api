import { HttpException, HttpStatus } from "@nestjs/common";

export class InvalidAddressException extends HttpException {
  constructor() {
    super(
      {
        error: InvalidAddressException.name,
        message: "Invalid address",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class DepositNotFoundException extends HttpException {
  constructor() {
    super(
      {
        error: DepositNotFoundException.name,
        message: "Deposit not found",
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
