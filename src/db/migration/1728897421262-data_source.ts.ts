import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728897421262 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
            ALTER TABLE folder
            ADD COLUMN "teamspaceId" INT DEFAULT NULL,
            ADD CONSTRAINT fk_teamspace FOREIGN KEY ("teamspaceId") REFERENCES teamspace(id) ON DELETE CASCADE;
            `
        )

        await queryRunner.query(
            `
            ALTER TABLE document
            ADD COLUMN "teamspaceId" INT DEFAULT NULL,
            ADD CONSTRAINT fk_folder FOREIGN KEY ("teamspaceId") REFERENCES teamspace(id) ON DELETE CASCADE;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
