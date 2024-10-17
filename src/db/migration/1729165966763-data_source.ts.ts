import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1729165966763 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
           ALTER TABLE "byte"
            ADD COLUMN "requestedByEmail" VARCHAR DEFAULT NULL;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
