// src/data-source.ts
import dotenv from 'dotenv';
dotenv.config();
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
import { Teamspace } from '../entities/teamspace';
import { UserTeamspace } from '../entities/user_teamspace';
import { ByteTeamspace } from '../entities/byte_teamspace';
import { Slack } from '../entities/slack';
import { SlackTeamspace } from '../entities/slack_teamspace';
import { TeamspaceChannels } from '../entities/teamspace_channels';

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || 'postgres-db',
    port: 5432,
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'admin',
    database: process.env.DATABASE_NAME || 'knowledgekeeper_develop',
    synchronize: false,
    logging: true,
    entities: [UserDetails,Client,Byte, ChangeLog, Folder, Recommendation, Document, Task, Teamspace, UserTeamspace, ByteTeamspace, Slack, SlackTeamspace, TeamspaceChannels],
    migrations: [path.join(__dirname, "migration/*.ts")]
});

AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized!");
        // Start your server or application logic here
    })
    .catch((error) => console.log("Error during Data Source initialization", error));