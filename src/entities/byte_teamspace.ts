import { Entity, PrimaryColumn } from 'typeorm';

@Entity('byte_teamspace')
export class ByteTeamspace {
    @PrimaryColumn()
    byteId: number;

    @PrimaryColumn()
    teamspaceId: number;
}