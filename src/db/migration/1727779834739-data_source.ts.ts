import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1727779834739 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            ALTER TABLE folder
                ADD COLUMN IF NOT EXISTS \"docId\" INT;
            `
        )

        await queryRunner.query(
            `
                ALTER TABLE folder
                ADD CONSTRAINT fk_docId
                FOREIGN KEY (\"docId\") REFERENCES document(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
