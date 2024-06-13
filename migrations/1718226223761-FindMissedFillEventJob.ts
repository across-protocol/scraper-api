import { MigrationInterface, QueryRunner } from "typeorm";

export class FindMissedFillEventJob1718226223761 implements MigrationInterface {
  name = "FindMissedFillEventJob1718226223761";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "find_missed_fill_event_job" (
      "id" SERIAL NOT NULL, 
      "depositPrimaryKey" integer NOT NULL, 
      "originChainId" integer NOT NULL, 
      "destinationChainId" integer NOT NULL, 
      "depositId" integer NOT NULL, 
      "depositDate" TIMESTAMP NOT NULL, 
      "status" character varying NOT NULL DEFAULT 'checking', 
      "lastFromBlockChecked" integer,
      "lastFromDateChecked" TIMESTAMP,
      "lastToBlockChecked" integer,
      "lastToDateChecked" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
      CONSTRAINT "PK_2bd48544e089c9be755477aab69" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`
      ALTER TABLE "find_missed_fill_event_job" 
      ADD CONSTRAINT "FK_fmfej_deposit" FOREIGN KEY ("depositPrimaryKey") 
      REFERENCES "deposit"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "find_missed_fill_event_job" DROP CONSTRAINT "FK_fmfej_deposit"`);
    await queryRunner.query(`DROP TABLE "find_missed_fill_event_job"`);
  }
}
