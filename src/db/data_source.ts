// src/data-source.ts
import { DataSource } from 'typeorm';
import { User } from '../entities/user';
import { Client } from '../entities/client';
import { Document } from '../entities/document';
import { Folder } from '../entities/folder';
import { ChangeLog } from '../entities/change_logs';
import { Byte } from '../entities/byte';
import { Recommendation } from '../entities/recommendation';

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "admin",
    password: "admin",
    database: "knowledgekeeper",
    synchronize: false,
    logging: true,
    entities: [User, Client, Document , Folder, ChangeLog, Byte, Recommendation],
    migrations: ["src/migration/**/*.ts"],
});