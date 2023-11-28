import { HttpException, HttpStatus } from "@nestjs/common";

export { InvalidAddressException } from "../../utils";

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
