import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728893042460 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
           ALTER TABLE "change_log"
            ADD COLUMN "aiRecommendationStatus" VARCHAR DEFAULT NULL;
            `
        )

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
