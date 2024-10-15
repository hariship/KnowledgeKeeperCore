import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728993599788 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
           ALTER TABLE "document"
            ADD COLUMN "teamspaceId" INT DEFAULT NULL;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
