import { MigrationInterface, QueryRunner } from "typeorm";

export class KnowledgeKeeperCore1725791691419 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_oauthprovider_enum') THEN
                    CREATE TYPE "public"."user_oauthprovider_enum" AS ENUM('MICROSOFT', 'GOOGLE', 'APPLE');
                END IF;
            END
            $$;
        `);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TYPE IF EXISTS "public"."user_oauthprovider_enum";
        `);
    }

}
