import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("teamspace_channels")
export class TeamspaceChannels {
  @PrimaryGeneratedColumn("uuid")
  teamspaceId: string; // Primary key for the table

  @Column({default: null})
  email: string

  @Column({
    type: "text",
    array: true,
    default: () => "'{}'", // Default to an empty array
  })
  channels: string[]; // Array of channels
}