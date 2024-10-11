import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728638133167 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "document"
            ADD COLUMN "s3Path" VARCHAR DEFAULT NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE "document"
            ADD COLUMN "s3DBPath" VARCHAR DEFAULT NULL;
        `);

        await queryRunner.query(`
            ALTER TABLE "document"
            ADD COLUMN "s3SentencedDocumentPath" VARCHAR DEFAULT NULL;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
