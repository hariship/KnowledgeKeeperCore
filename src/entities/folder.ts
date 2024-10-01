import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Client } from './client';

@Entity()
export class Folder {
    @PrimaryGeneratedColumn({ type: 'int', name: 'id', unsigned: true })
    id: number;

    @Column()
    folderName: string;

    @Column({ nullable: true })
    totalNumberOfDocs: number;

    @Column()
    isTrained: boolean;

    @Column()
    reTrainingRequired: boolean;

    @ManyToOne(() => Client)
    @JoinColumn({ name: "clientId" })
    client: Client
}