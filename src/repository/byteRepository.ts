import { Repository } from "typeorm";
import { Byte } from "../entities/byte";
import { AppDataSource } from "../db/data_source";
import { UserDetails } from "../entities/user_details";
import axios from 'axios';  
import { UserRepository } from "./userRepository";
import { Recommendation } from "../entities/recommendation";
import { Equal } from 'typeorm';

export class ByteRepository {
    private byteRepo: Repository<Byte>;
    private recommendationRepo: Repository<Recommendation>;

    constructor() {
        this.recommendationRepo = AppDataSource.getRepository(Recommendation);
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
          let byteSaved = await this.byteRepo.save(newByte);
          let recommendationResponse = await this.callExternalRecommendationService(byteSaved);
          if (recommendationResponse.data){
            let recommendationData = recommendationResponse.data?.data
            for(let recommendationContent of recommendationData){
              const newRecommendation = await this.recommendationRepo.create({
                byte: byteSaved,
                recommendation: recommendationContent,
                // document: "Door Dash Test 1",
                recommendationAction: recommendationContent?.metadata?.updation_type
              });
              await this.recommendationRepo.save(newRecommendation);
            }
          }
          byteSaved.noOfRecommendations = recommendationResponse?.data?.data.length
          await this.byteRepo.save(byteSaved)
          return byteSaved;
    }   

    async deleteByte(byteId:any): Promise<Byte | null> {
        const byte = await this.byteRepo.findOne({ where: { id: byteId } });
        if (!byte) throw new Error('Byte not found');
        await this.recommendationRepo.createQueryBuilder()
        .delete()
        .from(Recommendation)
        .where("byteId = :byteId", { byteId })
        .execute();
        await this.byteRepo.remove(byte);
        return byte;
    }

    async callExternalRecommendationService(byte: Partial<Byte>){
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
          return response;
    }

    async getRecommendations(byte: Partial<Byte>) {
        try {
          let recommendationsForByte = await this.recommendationRepo.find({
            where:{
              byte: {
                id: byte?.id
              }
            }
          })
          
          console.log('recommendationsForByte',recommendationsForByte)
          const docHTML = 'https://knowledgekeeper-docs.s3.us-east-2.amazonaws.com/Doordash/Doordash.html'
          // let response = await axios.post(
          //   `http://3.142.50.84:5000/v1/predict`,
          //   { 
          //     input_text: byte?.byteInfo,
          //     data_id: "Door Dash Test 1"
          //   },
          //   {
          //     headers: {
          //       'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499',
          //       'Content-Type': 'application/json'
          //     }
          //   }
          // );
          // response = response.data

          const response:any = {
            request_id: byte.id,
            request_text:
              byte.byteInfo,
            sender: byte?.requestedBy,
            date_time: byte?.createdAt,
            documents: [
              {
                doc_id: "Door Dash Test 1",
                doc_content: docHTML
                  ,
                recommendations:[]
              }
            ]
          }
          const recommendations = []
          if(recommendationsForByte){
            for(let recommendationByte of recommendationsForByte){
              const recommendationJson = JSON.parse(recommendationByte?.recommendation)
              recommendations.push({
                id: recommendationByte.id,
                change_request_type: (recommendationByte?.recommendationAction == 'new_section' || recommendationByte?.recommendationAction == 'add')  ? 'Add' : 'Replace',
                change_request_text: recommendationJson?.generated_text,
                    previous_string: recommendationJson?.sectionContent,
              })
            }
          }

          response.documents[0].recommendations.push(...recommendations)

          return response;
        } catch (error) {
          console.error('Error fetching recommendations:', error);
          throw new Error('Failed to fetch recommendations');
        }
      }
}