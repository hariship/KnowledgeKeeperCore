import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728493718830 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendationaction_enum') THEN
                    DROP TYPE recommendationaction_enum;
                END IF;
            END $$;
        `);

        // Change the column to string (varchar)
        await queryRunner.query(`
            ALTER TABLE "recommendation"
            ALTER COLUMN "recommendationAction" TYPE VARCHAR;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
