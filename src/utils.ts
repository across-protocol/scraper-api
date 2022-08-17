import { applyDecorators } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

export const wait = (seconds = 1) =>
  new Promise((res) => {
    setTimeout(res, 1000 * seconds);
  });

export const EnhancedCron = (cronExpression: string) => {
  if (process.env.DISABLE_CRONS != "true") return applyDecorators(Cron(cronExpression));
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  else return () => {};
};
