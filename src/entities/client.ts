import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Folder } from './folder';
import { Document } from './document';
import { Teamspace } from './teamspace';

@Entity()
export class Client {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    clientName: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ nullable: true })
    totalNumberOfDocs: number;

    @Column({ nullable: true })
    totalNumberOfFolders: number;

    @OneToMany(() => Folder, (folder: { client: any; }) => folder.client)
    folders: Folder[];

    @OneToMany(() => Teamspace, (teamspace: { client: any; }) => teamspace.client)
    teamspaces: Teamspace[];
}