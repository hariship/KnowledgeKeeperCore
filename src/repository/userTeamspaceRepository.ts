import { EntityRepository, Repository } from 'typeorm';
import { UserTeamspace } from '../entities/user_teamspace';
import { AppDataSource } from '../db/data_source';
import { Teamspace } from '../entities/teamspace';

export class UserTeamspaceRepository{

    private userTeamspaceRepo: Repository<UserTeamspace>;

    constructor() {
        this.userTeamspaceRepo = AppDataSource.getRepository(UserTeamspace); // Get the UserDetails repository from AppDataSource
    }

    // Function to find a specific user invited to a teamspace
    async findUserInTeamspace(userId: number, teamspaceId: number): Promise<UserTeamspace | null> {
        return this.userTeamspaceRepo.findOne({
            where: {
                user: { id: userId },
                teamspace: { id: teamspaceId }
            }
        });
    }

    // Function to get all teamspace invites for a specific user
    async findTeamspacesForUser(userId: number): Promise<UserTeamspace[]> {
        return this.userTeamspaceRepo.find({
            where: { user: { id: userId } },
            relations: ['teamspace']  // load related teamspace data
        });
    }

    // Function to get all users invited to a specific teamspace
    async findUsersInTeamspace(teamspaceId: number): Promise<UserTeamspace[]> {
        return this.userTeamspaceRepo.find({
            where: { teamspace: { id: teamspaceId } },
            relations: ['user'] // load related user data
        });
    }

        // Function to get all users invited to a specific teamspace
        async saveTeamspace(teamspace: Partial<Teamspace>): Promise<UserTeamspace> {
            return this.userTeamspaceRepo.save(teamspace);
        }
}