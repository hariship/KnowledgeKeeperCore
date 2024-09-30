import { query } from "express";
import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1727689660347 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            ALTER TABLE document
                ADD COLUMN IF NOT EXISTS \"clientId\" INT;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
