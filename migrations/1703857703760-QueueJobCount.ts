import { MigrationInterface, QueryRunner } from "typeorm";

export class QueueJobCount1703857703760 implements MigrationInterface {
  name = "QueueJobCount1703857703760";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "monitoring"."queue_job_count" (
        "id" SERIAL NOT NULL, 
        "queueName" character varying NOT NULL, 
        "waiting" integer NOT NULL, 
        "active" integer NOT NULL, 
        "failed" integer NOT NULL, 
        "delayed" integer NOT NULL, 
        "completed" integer NOT NULL, 
        "paused" integer NOT NULL, 
        "date" TIMESTAMP NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "PK_dc492204592047195b591166c0e" PRIMARY KEY ("id"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "monitoring"."queue_job_count"`);
  }
}
