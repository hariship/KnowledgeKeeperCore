import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728986798263 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
           ALTER TABLE "byte"
            ADD COLUMN "userFeedback" VARCHAR DEFAULT NULL;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
