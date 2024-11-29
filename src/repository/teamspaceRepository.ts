import { EntityRepository, In, Repository } from 'typeorm';
import { Teamspace } from '../entities/teamspace';
import { AppDataSource } from '../db/data_source';
import { ChangeLogRepository } from './changeLogRespository';
import { ByteRepository } from './byteRepository';
import { DocumentRepository } from './documentRepository';
import { UserTeamspaceRepository } from './userTeamspaceRepository';

export class TeamspaceRepository{

    private teamspaceRepo: Repository<Teamspace>;

    constructor() {
        this.teamspaceRepo = AppDataSource.getRepository(Teamspace); // Get the UserDetails repository from AppDataSource
    }
  
    async isUniqueTeamspaceNameByClient(clientId:number,teamspaceName: string): Promise<any>{
       // Query to check if a teamspace with the same name exists under the specified client
       try{
       const existingTeamspace = await this.teamspaceRepo.findOne({
        where: {
          client: {
            id: clientId
          },
          teamspaceName: teamspaceName
        }
      });

      // If the query returns a result, it means the teamspace name is not unique
      return existingTeamspace;
    } catch (error:any) {
      console.error('Error checking teamspace name uniqueness:', error);
      return false;
    }
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
            id: teamspaceId
        }, 
        relations: ['document'] }
    );
  }

  // Get a teamspace by its ID
  async getTeamspaceByName(teamspaceName: string): Promise<Teamspace | null> {
    return this.teamspaceRepo.findOne({
        where:{
            teamspaceName
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
    // Step 1: Extract all documents for the teamspace
    const documentRepo = new DocumentRepository();
    const changeLogRepo = new ChangeLogRepository();
    const byteRepo = new ByteRepository();
    const userTeamspaceRepo =  new UserTeamspaceRepository();
    await userTeamspaceRepo.removeUserTeamspaceByTeamspaceId(teamspaceId);

    const documents = await documentRepo.getAllDocumentsByTeamspace(teamspaceId);
    // Step 2: Extract all document IDs
    const documentIds = documents.map(doc => doc.id);

    // Step 3: Remove entries from ChangeLog based on docId
    if (documentIds.length > 0) {
      await changeLogRepo.deleteChangeLogBasedOnDocId(documentIds)
    }

    // Step 4: Remove entries from RecommendationRepo based on docId
    if (documentIds.length > 0) {
      await byteRepo.removeRecommendationBasedOnDocId(documentIds)
    }

    // Step 5: Remove entries from Document table based on document IDs
    if (documentIds.length > 0) {
      await documentRepo.deleteDocumentsBasedOnDocIds(documentIds)
    }

    // Step 6: Remove entries from Folder table based on teamspaceId
    await documentRepo.deleteFolderBasedOnTeamspace(teamspaceId)

    

    await this.teamspaceRepo.delete(teamspaceId);
  }
}