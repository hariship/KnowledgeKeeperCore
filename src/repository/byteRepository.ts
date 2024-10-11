import { Repository } from "typeorm";
import { Byte } from "../entities/byte";
import { AppDataSource } from "../db/data_source";
import { UserDetails } from "../entities/user_details";
import axios from 'axios';  
import { UserRepository } from "./userRepository";
import { Recommendation } from "../entities/recommendation";
import { Equal } from 'typeorm';
import { DocumentRepository } from "./documentRepository";

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
                document: recommendationContent?.document_id,
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

    async getRecommendationsBasedOnDocId(documentId: number) {
      try {
        // Fetch recommendations based on documentId
        let recommendationsForDocument = await this.recommendationRepo.find({
            where: {
                document: {
                    id: documentId
                }
            },
            relations: ['byte'] // Ensure to load the related byte entity
        });

        // Fetch bytes associated with the document (assuming a relationship exists)
        const bytes = await this.byteRepo.find({
            where: {
                docId: {
                  id: documentId
                }
            }
        });

        // Replace the static document URL with dynamic content
        const docHTML = `https://knowledgekeeper-docs.s3.us-east-2.amazonaws.com/${documentId}.html`;

        // Initialize response
        const response: any = {
            document: {
                doc_id: documentId,
                doc_content: docHTML,
                bytes: []
            }
        };

        // Organize recommendations by bytes
        const byteRecommendationsMap = new Map();

        if (recommendationsForDocument) {
            for (let recommendation of recommendationsForDocument) {
                const byteId = recommendation.byte?.id; // Assuming each recommendation is associated with a byte
                if (!byteRecommendationsMap.has(byteId)) {
                    byteRecommendationsMap.set(byteId, []);
                }
                const recommendationJson = JSON.parse(recommendation?.recommendation);
                byteRecommendationsMap.get(byteId).push({
                    id: recommendation.id,
                    change_request_type:
                        recommendation?.recommendationAction == 'new_section' ||
                        recommendation?.recommendationAction == 'add'
                            ? 'Add'
                            : 'Replace',
                    change_request_text: recommendationJson?.generated_text,
                    previous_string: recommendationJson?.sectionContent
                });
            }
        }

        // Add recommendations to each byte in the response
        for (const byte of bytes) {
            response.document.bytes.push({
                request_id: byte.id, // Byte ID as request_id
                request_text: byte.byteInfo, // Byte information as request_text
                sender: byte?.requestedBy?.email || 'Unknown', // Sender, if applicable
                date_time: byte?.createdAt || new Date(), // Date time from the byte
                isProcessedByRecommendation: byte.isProcessedByRecommendation,
                recommendations: byteRecommendationsMap.get(byte.id) || []
            });
        }

        return response;
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        throw new Error('Failed to fetch recommendations');
    } 
    }

    async getRecommendations(byte: Partial<Byte>) {
        try {
          let recommendationsForByte = await this.recommendationRepo.find({
            where:{
              byte: {
                id: byte?.id
              }
            },
            relations: ['document']
          })

          const response:any = {
            request_id: byte.id,
            request_text:
              byte.byteInfo,
            sender: byte?.requestedBy,
            date_time: byte?.createdAt,
            documents: [
              {
                doc_id: byte.docId,
                doc_content: byte.docId?.docContentUrl
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