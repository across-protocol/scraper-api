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
