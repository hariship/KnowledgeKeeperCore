import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1732699189226 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
                CREATE TABLE byte_teamspace (
                    \"byteId\" INT,
                    \"teamspaceId\" INT,
                    PRIMARY KEY (\"byteId\", \"teamspaceId\")
                );
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}