import { MigrationInterface, QueryRunner } from "typeorm";

export class InitDB1725791466074 implements MigrationInterface {
    name = 'InitDB1725791466074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('CREATE TYPE "public"."user_oauthprovider_enum" AS ENUM(\'MICROSOFT\', \'GOOGLE\', \'APPLE\');')
        await queryRunner.query(`CREATE TABLE "user_details" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "oAuthProvider" "public"."user_oauthprovider_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "client" ("id" SERIAL NOT NULL, "clientName" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "totalNumberOfDocs" integer, "totalNumberOfFolders" integer, CONSTRAINT "PK_96da49381769303a6515a8785c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "folder" ("id" SERIAL NOT NULL, "folderName" character varying NOT NULL, "totalNumberOfDocs" integer, "isTrained" boolean NOT NULL, "reTrainingRequired" boolean NOT NULL, CONSTRAINT "PK_6278a41a706740c94c02e288df8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "document" ("id" SERIAL NOT NULL, "docContentUrl" character varying NOT NULL, "isTrained" boolean NOT NULL, "versionNumber" double precision NOT NULL, "updatedAt" TIMESTAMP NOT NULL, "reTrainingRequired" boolean NOT NULL, "clientId" integer, "folderId" integer, "createdBy" integer, "updatedBy" integer, CONSTRAINT "PK_e57d3357f83f3cdc0acffc3d777" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "byte" ("id" SERIAL NOT NULL, "byteInfo" character varying NOT NULL, "noOfRecommendations" integer, "isProcessedByRecommendation" boolean NOT NULL, "requestedBy" integer, CONSTRAINT "PK_4bc0a7d707b7986e457ee15e02f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."change_log_sectionheadingtype_enum" AS ENUM('h1', 'h2', 'h3', 'h4')`);
        await queryRunner.query(`CREATE TABLE "change_log" ("id" SERIAL NOT NULL, "changeRequestType" character varying NOT NULL, "changeSummary" text NOT NULL, "sectionHeadingType" "public"."change_log_sectionheadingtype_enum" NOT NULL, "sectionHeadingText" text NOT NULL, "sectionContent" text NOT NULL, "externalAttributeId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isTrained" boolean NOT NULL, "docId" integer, "byteId" integer, "changedBy" integer, CONSTRAINT "PK_d00462cfb97b72c95357d559136" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."recommendation_recommendationaction_enum" AS ENUM('ACCEPT', 'REJECT')`);
        await queryRunner.query(`CREATE TABLE "recommendation" ("id" SERIAL NOT NULL, "recommendationAction" "public"."recommendation_recommendationaction_enum" NOT NULL, "recommendation" text NOT NULL, "byteId" integer, "docId" integer, CONSTRAINT "PK_17cb51984a6627ef2ce7370e23c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_ba81651e4c4251969ba7bcbd1bc" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_76b187510eda9c862f9944808a8" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_a581782d3fe36e6cb98e40b0572" FOREIGN KEY ("createdBy") REFERENCES "user_details"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document" ADD CONSTRAINT "FK_b673325f49729b6320020c7bec6" FOREIGN KEY ("updatedBy") REFERENCES "user_details"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "byte" ADD CONSTRAINT "FK_d94a11a3fccf94cacafd577a238" FOREIGN KEY ("requestedBy") REFERENCES "user_details"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "change_log" ADD CONSTRAINT "FK_7047a0236d18fb8d10f1ebf7c84" FOREIGN KEY ("docId") REFERENCES "document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "change_log" ADD CONSTRAINT "FK_8d15d51e8a35cbc5afc3f8c90fe" FOREIGN KEY ("byteId") REFERENCES "byte"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "change_log" ADD CONSTRAINT "FK_06f66a69771e43e01c5115499ee" FOREIGN KEY ("changedBy") REFERENCES "user_details"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recommendation" ADD CONSTRAINT "FK_39ba66f0679dc35e662f36e2556" FOREIGN KEY ("byteId") REFERENCES "byte"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recommendation" ADD CONSTRAINT "FK_56039e9706cc1f0d036f042d281" FOREIGN KEY ("docId") REFERENCES "document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recommendation" DROP CONSTRAINT "FK_56039e9706cc1f0d036f042d281"`);
        await queryRunner.query(`ALTER TABLE "recommendation" DROP CONSTRAINT "FK_39ba66f0679dc35e662f36e2556"`);
        await queryRunner.query(`ALTER TABLE "change_log" DROP CONSTRAINT "FK_06f66a69771e43e01c5115499ee"`);
        await queryRunner.query(`ALTER TABLE "change_log" DROP CONSTRAINT "FK_8d15d51e8a35cbc5afc3f8c90fe"`);
        await queryRunner.query(`ALTER TABLE "change_log" DROP CONSTRAINT "FK_7047a0236d18fb8d10f1ebf7c84"`);
        await queryRunner.query(`ALTER TABLE "byte" DROP CONSTRAINT "FK_d94a11a3fccf94cacafd577a238"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_b673325f49729b6320020c7bec6"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_a581782d3fe36e6cb98e40b0572"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_76b187510eda9c862f9944808a8"`);
        await queryRunner.query(`ALTER TABLE "document" DROP CONSTRAINT "FK_ba81651e4c4251969ba7bcbd1bc"`);
        await queryRunner.query(`DROP TABLE "recommendation"`);
        await queryRunner.query(`DROP TYPE "public"."recommendation_recommendationaction_enum"`);
        await queryRunner.query(`DROP TABLE "change_log"`);
        await queryRunner.query(`DROP TYPE "public"."change_log_sectionheadingtype_enum"`);
        await queryRunner.query(`DROP TABLE "byte"`);
        await queryRunner.query(`DROP TABLE "document"`);
        await queryRunner.query(`DROP TABLE "folder"`);
        await queryRunner.query(`DROP TABLE "client"`);
        await queryRunner.query(`DROP TABLE "user"`);
    }

}
