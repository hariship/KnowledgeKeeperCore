import { TeamspaceChannels } from "../entities/teamspace_channels";
import { AppDataSource } from "../db/data_source";
import { Teamspace } from "../entities/teamspace";
import { TeamspaceRepository } from "./teamspaceRepository";
import { Repository } from "typeorm";


export class TeamspaceChannelsRepository {
    private teamspaceChannelsRepository: any
    private teamspaceRepo: Repository<Teamspace>
    constructor() {
        this.teamspaceChannelsRepository = AppDataSource. getRepository(TeamspaceChannels);
        this.teamspaceRepo =  AppDataSource.getRepository(Teamspace)
    }

    async saveTeamspaceChannel(teamspaceId: number, channels: string[]){
       return this.teamspaceChannelsRepository.save({
            teamspaceId,
            channels,
          });
          
    }

    async saveTeamspaceChannelUsingTeamspaceName(teamspaceName: string, email: string, channel: string) {
      
        // Step 1: Find the teamspace by name
        const teamspace: Teamspace | null = await this.teamspaceRepo.findOne({ where: { teamspaceName } });
      
        if (!teamspace) {
          throw new Error(`Teamspace with name "${teamspaceName}" not found.`);
        }
      
        // Step 2: Check if the channel entry already exists
        const existingChannel: TeamspaceChannels | null = await this.teamspaceChannelsRepository.findOne({
          where: {
            teamspaceId: teamspace.id,
            email,
          },
        });
      
        if (existingChannel) {
          // Update existing entry
          existingChannel.channels = [channel];
          return this.teamspaceChannelsRepository.save(existingChannel);
        }
      
        // Step 3: Create a new entry
        const newChannel = this.teamspaceChannelsRepository.create({
          teamspaceId: teamspace.id,
          email,
          channels: [channel]
        });
      
        return this.teamspaceChannelsRepository.save(newChannel);
      }

    async findByTeamspaceName(teamspaceName: string) {
        return this.teamspaceChannelsRepository.findOne({
          where: {
            teamspace: {
              teamspaceName: teamspaceName, // Use the relation to filter by teamspaceName
            },
          },
          relations: ['teamspace'], // Load the related teamspace entity
        });
      }

    async findByEmail(email: string) {
        return this.teamspaceChannelsRepository.find({ where: { email } });
      }

    async getTeamspaceChannelsByUser(email: string){
        return this.teamspaceChannelsRepository.find({
            where: {
                email
            }
        });
    }

}