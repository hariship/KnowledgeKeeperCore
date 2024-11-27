import { Entity, PrimaryGeneratedColumn, Column, Timestamp } from 'typeorm';

@Entity()
export class Task {
    @PrimaryGeneratedColumn('uuid') // UUID primary key
    taskId: string;

    @Column({ length: 255 })
    taskName: string;

    @Column({ length: 50 })
    taskStatus: string;

    @Column({ type: 'uuid', nullable: true })
    dataId: string

    @Column({nullable: true })
    byteId: number

    @Column({type: 'date', nullable: true })
    createdAt: Date

    @Column({nullable: true })
    docId: number
}