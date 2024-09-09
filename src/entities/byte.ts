import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user';

@Entity()
export class Byte {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    byteInfo: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "requestedBy" })
    requestedBy: User;

    @Column({ nullable: true })
    noOfRecommendations: number;

    @Column()
    isProcessedByRecommendation: boolean;
}