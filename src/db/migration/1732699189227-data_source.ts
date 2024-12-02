import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1732699189227 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
                CREATE TABLE slack (
                    "id" INT PRIMARY KEY,   
                    "teamName" VARCHAR(255) NOT NULL,
                    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
                );
            
                CREATE TABLE slack_teamspace (
                    \"slackId\" INT,
                    \"teamspaceId\" INT,
                    PRIMARY KEY (\"slackId\", \"teamspaceId\")
                );
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}