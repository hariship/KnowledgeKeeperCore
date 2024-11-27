import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1732699189225 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
             ALTER TABLE "task"
             ADD COLUMN "docId" INTEGER DEFAULT NULL;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
