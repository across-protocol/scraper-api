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
