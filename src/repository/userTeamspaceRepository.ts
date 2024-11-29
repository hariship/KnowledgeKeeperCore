import { EntityRepository, Repository } from 'typeorm';
import { UserTeamspace } from '../entities/user_teamspace';
import { AppDataSource } from '../db/data_source';
import { Teamspace } from '../entities/teamspace';
import { UserDetails } from '../entities/user_details';
import { UserRepository } from './userRepository';
import { TeamspaceRepository } from './teamspaceRepository';

export class UserTeamspaceRepository{

    private userTeamspaceRepo: Repository<UserTeamspace>;

    constructor() {
        this.userTeamspaceRepo = AppDataSource.getRepository(UserTeamspace); // Get the UserDetails repository from AppDataSource
    }

    async removeUserTeamspaceByTeamspaceId(teamspaceId: number){
      const accessRecord =  await this.userTeamspaceRepo.findOne({
          where: {
            teamspace: { id: teamspaceId },
          },
        });

        if (accessRecord) {
          await this.userTeamspaceRepo.remove(accessRecord);
          return true;
        }
    
        // Remove access
        return false;
  }

    async removeUserTeamspaceAccessRecord(teamspaceId: number, userId: number){
        const accessRecord =  await this.userTeamspaceRepo.findOne({
            where: {
              teamspace: { id: teamspaceId },
              user: { id: userId },
            },
          });

          if (!accessRecord) {
            return {
              status: 'error',
              message: 'User-teamspace access not found.',
            };
          }
      
          // Remove access
          await this.userTeamspaceRepo.remove(accessRecord);
    }

    async findUsersByTeamspaceId(teamspaceId: number): Promise<UserDetails[]> {
        const userTeamspaceRecords = await this.userTeamspaceRepo.find({
          where: {
            teamspace: { id: teamspaceId },
          },
          relations: ['user'],
        });
        // Extract users
        const users = userTeamspaceRecords.map(record => record.user);
    
        // Remove duplicates based on user id
        const uniqueUsers = Array.from(new Map(users.map(user => [user.id, user])).values());
          
        return uniqueUsers;
      }

    async findUserTeamspacesForClient(userId: number): Promise<Teamspace[]> {
        // Fetch records with the given userId
        const results = await this.userTeamspaceRepo.find({
          where: {
            user: { id: userId }, // Ensure filtering by userId
          },
          relations: ['user', 'teamspace', 'teamspace.folder','teamspace.folder.documents'], // Load the required relations
        });
      
        console.log('Fetched UserTeamspace records:', results);
      
        // If no records are found, return an empty array
        if (results.length === 0) {
          console.log('No UserTeamspace records found for userId:', userId);
          return [];
        }
      
        // Map and return only the teamspace objects
        return results.map((record) => record.teamspace);
      }

    /**
     * Checks if a user has access to a specific teamspace.
     * @param userId - The ID of the user
     * @param teamspaceId - The ID of the teamspace
     * @returns A Promise that resolves to true if the user has access, false otherwise
     */
    async checkUserAccessToTeamspace(userId: number, teamspaceId: number): Promise<boolean> {
        const accessRecord = await this.userTeamspaceRepo.findOne({
            where: {
              user: { id: userId },
              teamspace: { id: teamspaceId },
            },
          });
      
          return !!accessRecord; // Returns true if accessRecord exists, false otherwise      
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
      async saveUserTeamspace(userId: number, teamspaceId: number, role?: string): Promise<UserTeamspace> {
        const userRepo = new UserRepository();
        const teamspaceRepo = new TeamspaceRepository();
        // Fetch the related UserDetails and Teamspace entities
        const user = await userRepo.findUserById(userId)
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }
    
        const teamspace = await teamspaceRepo.getTeamspaceById(teamspaceId)
        if (!teamspace) {
            throw new Error(`Teamspace with id ${teamspaceId} not found`);
        }
    
        // Create a new UserTeamspace entity
        const userTeamspace = this.userTeamspaceRepo.create({
            user,
            teamspace,
            role: 'MEMBER', // Set role if provided, otherwise leave it null
            status: "INVITED", // Default status
        });
    
        // Save the entity
        return this.userTeamspaceRepo.save(userTeamspace);
    }
}