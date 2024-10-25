import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1729849316264 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
             ALTER TABLE "task"
             ADD COLUMN "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NULL;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
