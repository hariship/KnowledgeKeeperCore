import { TeamspaceChannels } from "../entities/teamspace_channels";
import { AppDataSource } from "../db/data_source";
import { Slack } from "../entities/slack";


export class SlackRepository {
    private slackRepository: any
        constructor() {
        this.slackRepository = AppDataSource. getRepository(Slack);
    }

    async getSlackTokensById(slackId: string){
        return this.slackRepository.findOne({
            where: {
                id: slackId
            }
        })
    }

}