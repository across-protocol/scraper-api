import { MigrationInterface, QueryRunner } from "typeorm";

export class SetPoolRebalanceRouteEvent1729599625420
  implements MigrationInterface
{
  name = "SetPoolRebalanceRouteEvent1729599625420";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events"."set_pool_rebalance_route_event" ADD "date" TIMESTAMP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events"."set_pool_rebalance_route_event" DROP COLUMN "date"`,
    );
  }
}
