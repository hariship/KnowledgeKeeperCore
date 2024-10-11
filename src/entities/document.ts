import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from './client';
import { UserDetails } from './user_details';
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
    documentName: string;

    @Column()
    docContentUrl: string;

    @Column()
    isTrained: boolean;

    @Column({ type: "float" })
    versionNumber: number;

    @ManyToOne(() => UserDetails)
    @JoinColumn({ name: "createdBy" })
    createdBy: UserDetails;

    @ManyToOne(() => UserDetails)
    @JoinColumn({ name: "updatedBy" })
    updatedBy: UserDetails;

    @Column()
    updatedAt: Date;

    @Column()
    reTrainingRequired: boolean;

    @Column({ nullable: true })
    s3Path: string;

    @Column({ nullable: true })
    s3DBPath: string;

    @Column({ nullable: true })
    s3SentencedDocumentPath: string;
}