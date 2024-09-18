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
        return await this.clientRepo.findOneBy({ id: clientId });
    }

}