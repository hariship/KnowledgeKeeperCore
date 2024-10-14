import { EntityRepository, Repository } from 'typeorm';
import { Teamspace } from '../entities/teamspace';
import { AppDataSource } from '../db/data_source';

export class TeamspaceRepository{

    private teamspaceRepo: Repository<Teamspace>;

    constructor() {
        this.teamspaceRepo = AppDataSource.getRepository(Teamspace); // Get the UserDetails repository from AppDataSource
    }
  
  // Create a new teamspace
  async createTeamspace(teamspaceData: Partial<Teamspace>): Promise<Teamspace> {
    const newTeamspace = this.teamspaceRepo.create(teamspaceData);
    return this.teamspaceRepo.save(newTeamspace);
  }

  // Find all teamspaces by clientId
  async findTeamspacesByClientId(clientId: number): Promise<Teamspace[]> {
    return this.teamspaceRepo.find({
      where: { client: { id: clientId } },
      relations: ['document'], // Include related documents
    });
  }

  // Get a teamspace by its ID
  async getTeamspaceById(teamspaceId: number): Promise<Teamspace | null> {
    return this.teamspaceRepo.findOne({
        where:{
            id:teamspaceId
        }, 
        relations: ['document'] }
    );
  }

  // Update a teamspace
  async updateTeamspace(teamspaceId: number, updateData: Partial<Teamspace>): Promise<Teamspace | null> {
    const teamspace = await this.teamspaceRepo.findOne({
        where: {
            id: teamspaceId
        }
    });
    if (!teamspace) {
      return null;
    }
    Object.assign(teamspace, updateData);
    return this.teamspaceRepo.save(teamspace);
  }

  // Delete a teamspace by ID
  async deleteTeamspace(teamspaceId: number): Promise<void> {
    await this.teamspaceRepo.delete(teamspaceId);
  }
}