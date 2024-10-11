import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728638438265 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            CREATE TABLE IF NOT EXISTS task (
                \"taskId\" UUID PRIMARY KEY,
                \"taskName\" VARCHAR(255),
                \"taskStatus\" VARCHAR(50)
            );
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
