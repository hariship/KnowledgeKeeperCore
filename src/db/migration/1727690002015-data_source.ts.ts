import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1727690002015 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
                ALTER TABLE document
                ADD COLUMN IF NOT EXISTS \"folderId\" INT;
            `
        )

        await queryRunner.query(
            `
                ALTER TABLE document
                ADD CONSTRAINT fk_folderId
                FOREIGN KEY (\"folderId\") REFERENCES folder(id)
                ON DELETE SET NULL
                ON UPDATE CASCADE;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
