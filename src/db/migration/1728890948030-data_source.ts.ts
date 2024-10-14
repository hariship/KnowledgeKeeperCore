import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728890948030 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
           ALTER TABLE "task"
            ADD COLUMN "dataId" UUID DEFAULT NULL;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
