import { MigrationInterface, QueryRunner } from "typeorm";

export class DataSourcets1728987642238 implements MigrationInterface { 
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE user_teamspace (
                id INT PRIMARY KEY AUTO_INCREMENT,
                "userId" INT NOT NULL,
                "teamspaceId" INT NOT NULL,
                status ENUM('INVITED', 'ACCEPTED', 'REJECTED') DEFAULT 'INVITED',
                role VARCHAR(255) DEFAULT 'MEMBER',
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT FK_user FOREIGN KEY ("userId") REFERENCES user_details(id) ON DELETE CASCADE,
                CONSTRAINT FK_teamspace FOREIGN KEY ("teamspaceId") REFERENCES teamspace(id) ON DELETE CASCADE
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE user_teamspace;
        `);
    }

}
