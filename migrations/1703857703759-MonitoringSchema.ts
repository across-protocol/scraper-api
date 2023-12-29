import { MigrationInterface, QueryRunner } from "typeorm";

export class MonitoringSchema1703857703759 implements MigrationInterface {
  name = "MonitoringSchema1703857703759";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS monitoring;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS monitoring;`);
  }
}
