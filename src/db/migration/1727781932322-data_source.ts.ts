import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1727781932322 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            ALTER TABLE byte
                ADD COLUMN IF NOT EXISTS \"status\" VARCHAR(255);
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
