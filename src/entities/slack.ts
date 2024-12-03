import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    CreateDateColumn,
    PrimaryColumn,
  } from 'typeorm';
  import { SlackTeamspace } from './slack_teamspace';
  
  @Entity('slack')
  export class Slack {
    @PrimaryColumn({ type: 'varchar', length: 255 }) // Set id as a primary key with type 'varchar'
    id: string;
  
    @Column({ type: 'varchar', length: 255 })
    teamName: string;

    @Column({ type: 'varchar', length: 500 })
    accessToken: string;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @OneToMany(() => SlackTeamspace, (slackTeamspace) => slackTeamspace.slack, {
      cascade: true,
    })
    slackTeamspaces: SlackTeamspace[];
  }