import { TeamspaceChannels } from "../entities/teamspace_channels";
import { AppDataSource } from "../db/data_source";


export class TeamspaceChannelsRepository {
    private teamspaceChannelsRepository: any
    constructor() {
        this.teamspaceChannelsRepository = AppDataSource. getRepository(TeamspaceChannels);
    }

    async saveTeamspaceChannel(teamspaceId: number, channels: string[]){
       return this.teamspaceChannelsRepository.save({
            teamspaceId,
            channels,
          });
          
    }

    async getTeamspaceChannelsByUser(email: string){
        return this.teamspaceChannelsRepository.find({
            where: {
                email
            }
        });
    }

}