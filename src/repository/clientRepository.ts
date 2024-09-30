import { Repository } from "typeorm";
import { Client } from "../entities/client";
import { AppDataSource } from "../db/data_source";

export class ClientRepository {
    private clientRepo: Repository<Client>;

    constructor() {
        this.clientRepo = AppDataSource.getRepository(Client);  // Get the Document repository from the AppDataSource
    }

    // Find a client by its ID
    async findClientById(clientId: number): Promise<Client | null> {
      return await this.clientRepo.findOne({
          where: { id: clientId },
          relations: ['documents', 'folders'] // Include related entities
      });
  }

    // Find a client by its ID
    async findClientByName(clientName: string): Promise<Client | null> {
        return await this.clientRepo.findOne({
            where:{
                clientName
            }
        });
    }

    async createClient(clientName: string): Promise<Client> {
        const newClient = this.clientRepo.create({
          clientName,
          totalNumberOfDocs: 0,
          totalNumberOfFolders: 0,
        });
    
        return await this.clientRepo.save(newClient);
      }

    async updateClient(clientId: number, updateData: Partial<Client>): Promise<Client | null> {
        const client = await this.clientRepo.findOneBy({ id: clientId });
    
        if (!client) {
          return null;  // Client not found
        }
    
        // Merge the updated fields into the existing client entity
        const updatedClient = this.clientRepo.merge(client, updateData);
    
        return await this.clientRepo.save(updatedClient);
      }

}