import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourceTs1726643100375 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`ALTER TYPE "public"."user_oauthprovider_enum" ADD VALUE 'LOCAL'; `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
