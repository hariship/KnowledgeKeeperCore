import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1732699189228 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            CREATE TABLE teamspace_channels (
                teamspaceId UUID PRIMARY KEY,   -- Unique identifier for each teamspace
                email VARCHAR(500) DEFAULT NULL,   --- Unique email of the user
                channels TEXT[] DEFAULT '{}'    -- Array of channels, defaulting to an empty array
            );
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}