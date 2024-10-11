// src/data-source.ts
import { DataSource } from 'typeorm';
import path from 'path';
import { UserDetails } from '../entities/user_details';
import { Client } from '../entities/client';
import { Byte } from '../entities/byte';
import { ChangeLog } from '../entities/change_logs';
import { Folder } from '../entities/folder';
import { Recommendation } from '../entities/recommendation';
import { Document } from '../entities/document';
import { Task } from '../entities/task';

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    username: "postgres",
    password: "admin",
    database: "knowledgekeeper",
    synchronize: false,
    logging: true,
    entities: [UserDetails,Client,Byte, ChangeLog, Folder, Recommendation, Document, Task],
    migrations: [path.join(__dirname, "migration/*.ts")]
});

AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
        // Start your server or application logic here
    })
    .catch((error) => console.log("Error during Data Source initialization", error));