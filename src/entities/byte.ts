import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { UserDetails } from './user_details';
import { Document } from './document';
import { Client } from './client';

@Entity()
export class Byte {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    byteInfo: string;

    @ManyToOne(() => UserDetails)
    @JoinColumn({ name: "requestedBy" })
    requestedBy: UserDetails;

    @Column({ nullable: true })
    noOfRecommendations: number;

    @Column()
    isProcessedByRecommendation: boolean;

    @Column()
    status: string;

    @ManyToOne(() => Document)
    @JoinColumn({name: 'docId'})
    docId: Document;

    @ManyToOne(() => Client)
    @JoinColumn({name: 'clientId'})
    clientId: Client;
}