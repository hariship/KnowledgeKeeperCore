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