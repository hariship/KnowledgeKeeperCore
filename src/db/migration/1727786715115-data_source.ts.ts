import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1727786715115 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            ALTER TABLE document
                ADD COLUMN IF NOT EXISTS \"documentName\" VARCHAR(255);
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
