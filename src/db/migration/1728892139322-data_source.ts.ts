import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728892139322 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
           ALTER TABLE "task"
            ADD COLUMN "byteId" UUID DEFAULT NULL;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
