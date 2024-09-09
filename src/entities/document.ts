import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from './client';
import { User } from './user';
import { Folder } from './folder';

@Entity()
export class Document {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: "clientId" })
    client: Client;

    @ManyToOne(() => Folder, { nullable: true })
    @JoinColumn({ name: "folderId" })
    folder: Folder;

    @Column()
    docContentUrl: string;

    @Column()
    isTrained: boolean;

    @Column({ type: "float" })
    versionNumber: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: "createdBy" })
    createdBy: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: "updatedBy" })
    updatedBy: User;

    @Column()
    updatedAt: Date;

    @Column()
    reTrainingRequired: boolean;
}