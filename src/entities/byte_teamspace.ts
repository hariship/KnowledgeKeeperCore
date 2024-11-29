import { Entity, PrimaryColumn } from 'typeorm';

@Entity('byte_teamspace')
export class ByteTeamspace {
    @PrimaryColumn()
    userId: number;

    @PrimaryColumn()
    teamspaceId: number;
}