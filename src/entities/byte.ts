import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { UserDetails } from './user_details';

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
}