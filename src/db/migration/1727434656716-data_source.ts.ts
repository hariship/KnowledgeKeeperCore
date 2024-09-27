import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1727434656716 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`ALTER TABLE byte add column docId int default null`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
