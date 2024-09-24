import { Repository } from "typeorm";
import { Byte } from "../entities/byte";
import { AppDataSource } from "../db/data_source";
import { UserDetails } from "../entities/user_details";


export class ByteRepository {
    private byteRepo: Repository<Byte>;

    constructor() {
        this.byteRepo = AppDataSource.getRepository(Byte);  // Get the Document repository from the AppDataSource
    }

    // Find a byte by its ID
    async findByteById(byteId: number): Promise<Byte | null> {
        return await this.byteRepo.findOneBy({ id: byteId });
    }

    // Find a byte by its ID
    async createByte(byteInfo: string, user: UserDetails): Promise<Byte | null> {
        const newByte = await this.byteRepo.create({
            byteInfo,
            requestedBy: user,
            noOfRecommendations: 0,
            isProcessedByRecommendation: false
          });
          return await this.byteRepo.save(newByte);
    }
}