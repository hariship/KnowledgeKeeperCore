import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1727689907599 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        
        await queryRunner.query(
            `
                ALTER TABLE document
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
