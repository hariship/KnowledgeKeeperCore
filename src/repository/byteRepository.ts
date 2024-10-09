import { Repository } from "typeorm";
import { Byte } from "../entities/byte";
import { AppDataSource } from "../db/data_source";
import { UserDetails } from "../entities/user_details";
import axios from 'axios';  
import { UserRepository } from "./userRepository";

export class ByteRepository {
    private byteRepo: Repository<Byte>;
    private userRepo: Repository<UserDetails>;

    constructor() {
        this.userRepo = AppDataSource.getRepository(UserDetails);
        this.byteRepo = AppDataSource.getRepository(Byte);  // Get the Document repository from the AppDataSource
    }

    async findAllOpenWithHighRecommendations(clientId:any) {
        // This method should fetch all bytes marked as 'open' with a high recommendationCount.
        // Implement the query based on your database schema.
        return this.byteRepo.find({
            where: {
                status: 'open',
                clientId
            },
            relations: ['clientId']
        });
    }

    async findByteWithDocById(id: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
            where: { id },
            relations: ['requestedBy', 'clientId','docId'],
        });
    }

        // Fetch all bytes with 'closed' status and high resolved recommendation count
    async findAllClosedWithHighResolvedRecommendations(clientId:any) {
        return this.byteRepo.find({
            where: {
                status: 'closed',
                clientId
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

    async findByteByClientAndDocument(byteId: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
          where: {
            id: byteId
          },
          relations: ['requestedBy', 'docId'],
        });
      }

    // Find a byte by its ID
    async createByte(byteInfo: any, user: UserDetails, clientId:any): Promise<Byte | null> {
        const newByte = await this.byteRepo.create({
            byteInfo,
            requestedBy: user,
            noOfRecommendations: 0,
            isProcessedByRecommendation: false,
            status: 'open',
            clientId
          });
          return await this.byteRepo.save(newByte);
    }

    async deleteByte(byteId:any): Promise<Byte | null> {
        const byte = await this.byteRepo.findOne({ where: { id: byteId } });
        if (!byte) throw new Error('Byte not found');
        await this.byteRepo.remove(byte);
        return byte;
    }

    async getRecommendations(byte: Partial<Byte>) {
        try {
          let response = await axios.post(
            `http://3.142.50.84:5000/v1/predict`,
            { 
              input_text: byte?.byteInfo,
              data_id: "Door Dash Test 1"
            },
            {
              headers: {
                'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499',
                'Content-Type': 'application/json'
              }
            }
          );
          response = response.data
          return {
            request_id: byte.id,
            request_text:
              byte.byteInfo,
            sender: byte?.requestedBy,
            date_time: byte?.createdAt,
            documents: [
              {
                doc_id: "Door Dash Test 1",
                doc_content:
                  '<html></html>',
                recommendations: [
                  {
                    id: 1,
                    change_request_type: response?.data[0]?.metadata.updation_type == 'new_section' ? 'Add' : 'Replace',
                    change_request_text:
                    response?.data[0]?.generated_text,
                    previous_string: response?.data[0]?.section_content,
                  }
                ],
              },
            ],
          };
        } catch (error) {
          console.error('Error fetching recommendations:', error);
          throw new Error('Failed to fetch recommendations');
        }
      }
}