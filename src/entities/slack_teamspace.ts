import {
    Entity,
    PrimaryColumn,
    ManyToOne,
    JoinColumn,
  } from 'typeorm';
  import { Slack } from './slack';
  
  @Entity('slack_teamspace')
  export class SlackTeamspace {
    @PrimaryColumn()
    slackId: string;
  
    @PrimaryColumn()
    teamspaceId: number;
  
    @ManyToOne(() => Slack, (slack) => slack.slackTeamspaces, {
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'slackId' })
    slack: Slack;
  }