import { MigrationInterface, QueryRunner } from "typeorm";

export class EventsSchema1681994187616 implements MigrationInterface {
  name = "EventsSchema1681994187616";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS events;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS events;`);
  }
}
