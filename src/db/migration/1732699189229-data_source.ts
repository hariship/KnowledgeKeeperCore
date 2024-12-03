import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1732699189229 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            ALTER TABLE slack add column "accessToken" varchar(500) DEFAULT NULL 
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}