import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1727779183682 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            ALTER TABLE byte
                ADD COLUMN IF NOT EXISTS \"clientId\" INT;
            `
        )

        await queryRunner.query(
            `
                ALTER TABLE byte
                ADD CONSTRAINT fk_clientId
                FOREIGN KEY (\"clientId\") REFERENCES client(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE;
            `
        )
        
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
