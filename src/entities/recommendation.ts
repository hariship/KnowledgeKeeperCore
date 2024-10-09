import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Document } from './document';
import { Byte } from './byte';

@Entity()
export class Recommendation {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Byte)
    @JoinColumn({ name: "byteId" })
    byte: Byte;

    @ManyToOne(() => Document)
    @JoinColumn({ name: "docId" })
    document: Document;

    @Column()
    recommendationAction: string;

    @Column("text")
    recommendation: string;
}