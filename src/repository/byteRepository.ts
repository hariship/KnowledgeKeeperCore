import { Repository } from "typeorm";
import { Byte } from "../entities/byte";
import { AppDataSource } from "../db/data_source";
import { UserDetails } from "../entities/user_details";
import axios from 'axios';  

export class ByteRepository {
    private byteRepo: Repository<Byte>;

    constructor() {
        this.byteRepo = AppDataSource.getRepository(Byte);  // Get the Document repository from the AppDataSource
    }

    async findAllOpenWithHighRecommendations(docId:any) {
        // This method should fetch all bytes marked as 'open' with a high recommendationCount.
        // Implement the query based on your database schema.
        return this.byteRepo.find({
            where: {
                status: 'open',
                docId
            },
            relations: ['docId']
        });
    }

    async findByteWithDocById(id: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
            where: { id },
            relations: ['requestedBy', 'docId'],
        });
    }

        // Fetch all bytes with 'closed' status and high resolved recommendation count
    async findAllClosedWithHighResolvedRecommendations(docId:any) {
        return this.byteRepo.find({
            where: {
                status: 'closed',
                docId
            },
            relations: ['docId']
        });
    }

    // Find a byte by its ID
    async findByteById(byteId: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
            where: { id: byteId },
            relations: ['docId']
        });
    }

    async findByteByClientAndDocument(documentId: number, byteId: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
          where: {
            id: byteId,
            docId: { id: documentId}, // Ensure it belongs to the correct document
          },
          relations: ['requestedBy', 'docId'],
        });
      }

    // Find a byte by its ID
    async createByte(byteInfo: any, user: UserDetails): Promise<Byte | null> {
        const newByte = await this.byteRepo.create({
            byteInfo,
            requestedBy: user,
            noOfRecommendations: 0,
            isProcessedByRecommendation: false
          });
          return await this.byteRepo.save(newByte);
    }

    async deleteByte(byteId:any): Promise<Byte | null> {
        const byte = await this.byteRepo.findOne({ where: { id: byteId } });
        if (!byte) throw new Error('Byte not found');
        await this.byteRepo.remove(byte);
        return byte;
    }

    async getRecommendations(docId:number | undefined, byteInfo: string) {
        try {
          const response = await axios.get(`http://18.116.71.195:5000/v1/recommend-bytes`, { params: { 
            input_text: byteInfo,
            data_id: docId,
            s3_db_path: '',
            s3_sentenced_document_path: "",
            s3_nli_model_path: "",
            s3_summarizer_model_path: ""
          }});
          return response.data; // Assuming the response is the data we want
        } catch (error) {
          console.error('Error fetching recommendations:', error);
          throw new Error('Failed to fetch recommendations');
        }
      }
}