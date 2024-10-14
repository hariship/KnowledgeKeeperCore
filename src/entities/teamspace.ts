import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Client } from './client';
import {Document} from './document';

@Entity()
export class Teamspace {
    @PrimaryGeneratedColumn({ type: 'int', name: 'id', unsigned: true })
    id: number;

    @Column()
    teamspaceName: string;

    @Column({ nullable: true })
    totalNumberOfDocs: number;

    @Column()
    isTrained: boolean;

    @Column()
    reTrainingRequired: boolean;

    @ManyToOne(() => Client)
    @JoinColumn({ name: "clientId" })
    client: Client
    
    @OneToMany(() => Document, (document: { folder: any; }) => document.folder)
    document: Document[];
}