import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from 'typeorm';
import { UserDetails } from './user_details';
import { Teamspace } from './teamspace';

@Entity('user_teamspace')
export class UserTeamspace {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => UserDetails)
    user: UserDetails;

    @ManyToOne(() => Teamspace)
    teamspace: Teamspace;

    @Column({
        type: "enum",
        enum: ["INVITED", "ACCEPTED", "REJECTED"],
        default: "INVITED"
    })
    status: string;

    @Column({ nullable: true })
    role: string;
}