import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Document } from './document';
import { Byte } from './byte';
import { UserDetails } from './user_details';

@Entity()
export class ChangeLog {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Document)
    @JoinColumn({ name: "docId" })
    document: Document;

    @ManyToOne(() => Byte)
    @JoinColumn({ name: "byteId" })
    byte: Byte;

    @ManyToOne(() => UserDetails)
    @JoinColumn({ name: "changedBy" })
    changedBy: UserDetails;

    @Column()
    changeRequestType: string;

    @Column("text")
    changeSummary: string;

    @Column("enum", { enum: ["h1", "h2", "h3", "h4"] })
    sectionHeadingType: string;

    @Column("text")
    sectionHeadingText: string;

    @Column("text")
    sectionContent: string;

    @Column()
    externalAttributeId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column()
    isTrained: boolean;
}