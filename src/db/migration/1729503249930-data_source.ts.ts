import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1729503249930 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            ALTER TABLE "change_log"
            ADD COLUMN "recommendationId" INTEGER DEFAULT NULL,
            ADD CONSTRAINT "fk_recommendationId" FOREIGN KEY ("recommendationId") REFERENCES "recommendation" ("id");
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
