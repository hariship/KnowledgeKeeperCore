import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728896706833 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            CREATE TABLE teamspace (
                id SERIAL PRIMARY KEY,
                "teamspaceName" VARCHAR(255) NOT NULL,
                "totalNumberOfDocs" INT DEFAULT 0,
                "isTrained" BOOLEAN NOT NULL,
                "reTrainingRequired" BOOLEAN NOT NULL,
                "clientId" INT DEFAULT NULL,
                CONSTRAINT fk_client FOREIGN KEY ("clientId") REFERENCES client(id) ON DELETE CASCADE
            );
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
