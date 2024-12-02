import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    CreateDateColumn,
  } from 'typeorm';
  import { SlackTeamspace } from './slack_teamspace';
  
  @Entity('slack')
  export class Slack {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column({ type: 'varchar', length: 255 })
    teamName: string;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @OneToMany(() => SlackTeamspace, (slackTeamspace) => slackTeamspace.slack, {
      cascade: true,
    })
    slackTeamspaces: SlackTeamspace[];
  }