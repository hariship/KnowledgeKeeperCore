import { In, Repository } from "typeorm";
import { Byte } from "../entities/byte";
import { AppDataSource } from "../db/data_source";
import { UserDetails } from "../entities/user_details";
import axios from 'axios';  
import { UserRepository } from "./userRepository";
import { Recommendation } from "../entities/recommendation";
import { Equal } from 'typeorm';
import { DocumentRepository } from "./documentRepository";
import { TaskRepository } from "./taskRepository";
import { STATUS, TASK_NAMES } from "../utils/constants";
const {v4: uuidv4 } = require('uuid');
import { Not } from 'typeorm';
import { Teamspace } from "../entities/teamspace";
import { ChangeLogRepository } from "./changeLogRespository";

export class ByteRepository {
    private byteRepo: Repository<Byte>;
    private recommendationRepo: Repository<Recommendation>;

    constructor() {
        this.recommendationRepo = AppDataSource.getRepository(Recommendation);
        this.byteRepo = AppDataSource.getRepository(Byte);  // Get the Document repository from the AppDataSource
    }

    async filterBytesWithUpdatedNoOfRecommendationCountForDeleted(clientId:any,teamspaceIds:any){
      let bytes = await this.byteRepo.find({
        where: {
            clientId,
            isDeleted: true
        },
        relations: ['clientId'],
        order: {
          createdAt: 'DESC'  // Replace `createdAt` with the field you want to sort by
      }
    });
    let filteredBytes = []
    let noOfRecommendations = 0
    for(const byte of bytes){
      const recommendationData = await this.recommendationRepo.find({
        where:{
          byte: {
            id: byte?.id
          },
          document: {
            teamspace: {
              id: In(teamspaceIds)
            }
          }
        },
        relations: ['byte','document','document.teamspace']
      })
      if(recommendationData){
        noOfRecommendations = recommendationData.length
        byte.noOfRecommendations = noOfRecommendations
        filteredBytes.push(byte)
      }
    }
    return { bytes:filteredBytes };
  }


    async findDeletedBytes(clientId: number,teamspaceIds:any) {
      let { bytes } = await this.filterBytesWithUpdatedNoOfRecommendationCountForDeleted(clientId, teamspaceIds);
      return bytes;
    }

    async filterBytesWithUpdatedNoOfRecommendationCount(clientId:any, status: string,teamspaceIds:any){
      console.log('teamspaceIds--------=')
      console.log(teamspaceIds)  
      console.log('teamspaceIds--------=')
      let bytes = await this.byteRepo.find({
          where: {
              status,
              clientId,
              isDeleted: false
          },
          relations: ['clientId'],
          order: {
            createdAt: 'DESC'  // Replace `createdAt` with the field you want to sort by
        }
      });
      let filteredBytes = []
      let noOfRecommendations = 0
      for(const byte of bytes){
        const recommendationData = await this.recommendationRepo.find({
          where:{
            byte: {
              id: byte?.id
            },
            document: {
              teamspace: {
                id: In (teamspaceIds)
              }
            }
          },
          relations: ['byte','document','document.teamspace']
        })
        console.log(recommendationData)
        if(recommendationData){
          noOfRecommendations = recommendationData.length
          byte.noOfRecommendations = noOfRecommendations
          filteredBytes.push(byte)
        }
      }
      console.log(filteredBytes)
      return { bytes:filteredBytes };
    }

    async findAllOpenWithHighRecommendations(clientId:any,teamspaceIds:any) {
        // This method should fetch all bytes marked as 'open' with a high recommendationCount.
        // Implement the query based on your database schema.

      let { bytes } = await this.filterBytesWithUpdatedNoOfRecommendationCount(clientId, 'open',teamspaceIds);
      return bytes;
    }

    async findByteWithDocById(id: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
            where: { id },
            relations: ['requestedBy', 'clientId','docId'],
        });
    }

    async saveByte(byte: Partial<Byte>): Promise<Byte | null> {
      return await this.byteRepo.save(byte)
   }

    async filterBytesWithUpdatedNoOfRecommendationCountForOthers(clientId:any, teamspaceIds: number []){
      let bytes = await this.byteRepo.find({
        where: {
            status:  Not('open'),
            clientId,
            isDeleted: false
        },
        relations: ['clientId'],
        order: {
          createdAt: 'DESC'  // Replace `createdAt` with the field you want to sort by
      }
    });
    let filteredBytes = []
    let noOfRecommendations = 0
    for(const byte of bytes){
      const recommendationData = await this.recommendationRepo.find({
        where:{
          byte: {
            id: byte?.id
          },
          document: {
            teamspace: {
              id: In(teamspaceIds)
            }
          }
        },
        relations: ['byte','document','document.teamspace']
      })
      if(recommendationData){
        noOfRecommendations = recommendationData.length
        byte.noOfRecommendations = noOfRecommendations
        filteredBytes.push(byte)
      }
    }
    return { bytes:filteredBytes };
  }

        // Fetch all bytes with 'closed' status and high resolved recommendation count
    async findAllClosedWithHighResolvedRecommendations(clientId:any, teamspaceIds: number []) {
        let {bytes } = await this.filterBytesWithUpdatedNoOfRecommendationCountForOthers(clientId,teamspaceIds);
        return bytes;
    }

    async handleRecommendationsRejected(byte: any, userId: number) {
      // Step 1: Call getRecommendations to get the list of documents and recommendations
      const response = await this.getRecommendations(byte);  // Assume this returns the recommendations in a set of documents
    
      // Step 2: Loop through the documents and their recommendations
      for (const doc of response.documents) {
        const docId = doc.doc_id;
    
        for (const recommendation of doc.recommendations) {
          const recommendationId = recommendation.id;
          const changeRequestType = recommendation.change_request_type; // 'Add' or 'Replace' based on your logic
          const changeSummary = 'REJECTED';  // As per your example
          const isTrained = false;  // Default to false unless updated otherwise
          const recommendationAction = 'REJECTED';  // Based on the action taken
    
          // Step 3: Call the changeLogRepo.createChangeLog function for each recommendation
          const changes:any = [];  // Assuming this is the format for changes, customize as needed
    
          try {
            const changeLogRepo = new ChangeLogRepository();
            await changeLogRepo.createChangeLog(
              userId,                 // User ID already available
              docId,                  // From the document object
              byte.id,                // Byte ID from the byte object
              changeRequestType,       // 'Add' or 'Replace'
              changes,                // Set to an empty array or provide actual changes
              changeSummary,          // Summary for the change
              isTrained,              // Whether or not it's trained
              recommendationAction,   // Action taken, in this case 'ACCEPT'
              recommendationId        // ID of the specific recommendation
            );
    
            console.log(`Change log created for recommendation ${recommendationId} in document ${docId}`);
          } catch (error) {
            console.error(`Error creating change log for recommendation ${recommendationId} in document ${docId}: `, error);
          }
        }
      }
    }

    async handleRecommendations(byte: any, userId: number) {
      
      // Step 1: Call getRecommendations to get the list of documents and recommendations
      const response = await this.getRecommendations(byte);  // Assume this returns the recommendations in a set of documents
    
      // Step 2: Loop through the documents and their recommendations
      for (const doc of response.documents) {
        const docId = doc.doc_id;
    
        for (const recommendation of doc.recommendations) {
          const recommendationId = recommendation.id;
          const changeRequestType = recommendation.change_request_type; // 'Add' or 'Replace' based on your logic
          const changeSummary = 'ACCEPTED';  // As per your example
          const isTrained = false;  // Default to false unless updated otherwise
          const recommendationAction = 'ACCEPTED';  // Based on the action taken
    
          // Step 3: Call the changeLogRepo.createChangeLog function for each recommendation
          const changes:any = [];  // Assuming this is the format for changes, customize as needed
    
          try {
            const changeLogRepo = new ChangeLogRepository();
            await changeLogRepo.createChangeLog(
              userId,                 // User ID already available
              docId,                  // From the document object
              byte.id,                // Byte ID from the byte object
              changeRequestType,       // 'Add' or 'Replace'
              changes,                // Set to an empty array or provide actual changes
              changeSummary,          // Summary for the change
              isTrained,              // Whether or not it's trained
              recommendationAction,   // Action taken, in this case 'ACCEPT'
              recommendationId        // ID of the specific recommendation
            );
    
            console.log(`Change log created for recommendation ${recommendationId} in document ${docId}`);
          } catch (error) {
            console.error(`Error creating change log for recommendation ${recommendationId} in document ${docId}: `, error);
          }
        }
      }
    }
    // Find a byte by its ID
    async findByteById(byteId: number): Promise<Byte | null> {
        return await this.byteRepo.findOne({
            where: { id: byteId },
            relations: ['docId','requestedBy']
        });
    }

    async findByteByClientAndDocument(byteId: number, teamspaceIds: number []): Promise<Byte | null> {
        let filteredByte: any = {}
        let noOfRecommendations = 0;
        const byte = await this.byteRepo.findOne({
          where: {
            id: byteId
          },
          relations: ['requestedBy', 'docId'],
        });
        if(byte){
          const recommendationData = await this.recommendationRepo.find({
            where:{
              byte,
              document: {
                teamspace: {
                  id: In(teamspaceIds)
                }
              }
            },
            relations: ['byte','document','document.teamspace']
          })
          if(recommendationData){
            noOfRecommendations = recommendationData.length
            byte.noOfRecommendations = noOfRecommendations
            filteredByte = byte
          }
        }
        return filteredByte;        
      }

      async callExternalRecommendationByteService(byteInfo: any, byteSaved: any, teamspaceIds: any, source: any) {
        try {
          const dataId = uuidv4();
          const teamspaceRepository = AppDataSource.getRepository(Teamspace);
          let teamspaces = []
          if(source == 'slack'){
            // Retrieve all teamspaces from the database
            teamspaces = await teamspaceRepository.find();
          }else{
            teamspaces = await teamspaceRepository.find({
              where: {
                id: In(teamspaceIds)
              }
            });
          }
          
      
          for (const teamspace of teamspaces) {
            // Update s3_db_path and s3_sentenced_document_path dynamically with the teamspace name
            const requestData = {
              data_id: dataId,
              input_text: byteInfo,
              s3_bucket: 'knowledge-keeper-results',
              teamspace_name: teamspace.teamspaceName,
              // s3_db_path: `data/test/${teamspace.teamspaceName}_db.ann`,
              s3_parsed_document_path: `data/test/${teamspace.teamspaceName}_parsed.csv`
            };
      
            try {
              // Send Axios POST request for each teamspace
              const response = await axios.post('http://18.116.66.245:9100/v2/recommend-bytes', requestData, {
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499'
                }
              });
      
              // Log response for each teamspace
              console.log(`Response for Teamspace ${teamspace.teamspaceName}:`, response.data);
              let finalResponse = response?.data
              if(finalResponse){
                const taskRepo = new TaskRepository();
                const taskName = TASK_NAMES.RECOMMEND_BYTES;
                await taskRepo.createTask(finalResponse.task_id, STATUS.PENDING, taskName, dataId, byteSaved.id)
              }
            } catch (error: any) {
              console.log(JSON.stringify(error))
              console.error(`Error for Teamspace ${teamspace.teamspaceName}:`, error.response ? error.response.data : error.message);
            }
          }
        } catch (error:any) {
          console.error('Error retrieving teamspaces:', error.message);
        }
      }

    // Find a byte by its ID
    async createByte(byteInfo: any, user: UserDetails, clientId:any, email?:string, teamspaceIds?: number [], source?: any): Promise<Byte | null> {
        const newByte = await this.byteRepo.create({
            byteInfo,
            requestedBy: user,
            noOfRecommendations: 0,
            isProcessedByRecommendation: false,
            status: 'open',
            clientId,
            requestedByEmail: email
          });
          let byteSaved = await this.byteRepo.save(newByte);
          let dataId = uuidv4();
          let response = await this.callExternalRecommendationByteService(byteInfo, byteSaved, teamspaceIds, source)
          return byteSaved;
    }  
    
    async updateByte(byteId: any, updatedData: any): Promise<Byte | null> {
      const byte = await this.byteRepo.findOne({ where: { id: byteId } });
      if (!byte) throw new Error('Byte not found');    
      const updatedByte = Object.assign(byte, updatedData);
      await this.byteRepo.save(updatedByte);
      return updatedByte;
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

    async deleteRecommendationByDocId(docId:number): Promise<Recommendation[] | null> {
      const recommendations = await this.recommendationRepo.find({ where: { document: {
        id:docId} } });
      if(recommendations){
        await this.recommendationRepo.remove(recommendations);
        let byteIds = recommendations.map(recommendation => recommendation?.byte?.id);
        for(let byteId of byteIds){
          let byte = await this.byteRepo.findOneBy({ 
              id: byteId
          })
          if(byte?.noOfRecommendations && byte?.noOfRecommendations > 0){
            await this.byteRepo.update(byteId, {noOfRecommendations: byte?.noOfRecommendations - 1} )
          }
        }
        return recommendations;
      }
      return null;
    }

    async callExternalRecommendationService(byte: Partial<Byte>){
        let uuid = uuidv4();
        let response = await axios.post(
            `http://18.116.66.245:9100/v1/predict`,
            { 
              input_text: byte?.byteInfo,
              data_id: uuid
            },
            {
              headers: {
                'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499',
                'Content-Type': 'application/json'
              }
            }
          );
          console.log(response)
          return response;
    }

    async saveRecommendations(result:any, byteId:any){
      let byteSaved = await this.byteRepo.findOne({
        where:{
          id:byteId
        }
      })
        if (result && byteSaved){
          let recommendationData = result?.data
          console.log('result')
          console.log(result)
          console.log('recommendationData')
          console.log(recommendationData)
          for(let recommendationContent of recommendationData){
            const taskRepo = new TaskRepository();
            recommendationContent = await taskRepo.getWrappedContent(recommendationContent)
            let documentRepo = new DocumentRepository();
            let document = await documentRepo.findDocumentById(parseInt(recommendationContent?.document_id))
            if(document){
              const newRecommendation = await this.recommendationRepo.create({
                byte: byteSaved,
                recommendation: recommendationContent,
                document,
                recommendationAction: recommendationContent?.metadata?.updation_type
              });
              await this.recommendationRepo.save(newRecommendation);
            }
            
          }
          byteSaved.noOfRecommendations = byteSaved.noOfRecommendations + result?.data.length
          await this.byteRepo.save(byteSaved)
        }
    }

    async removeRecommendationBasedOnDocId(documentIds: number []){
      if(documentIds){
        await this.recommendationRepo.delete({
          document: In(documentIds)
        })  
      }
    }

    async getRecommendationsBasedOnDocId(documentId: number) {
      try {
        // Fetch recommendations that are not present in change_log
        let recommendationsForDocument = await this.recommendationRepo
          .createQueryBuilder("recommendation")
          .leftJoinAndSelect("recommendation.byte", "byte")
          .leftJoinAndSelect("recommendation.document", "document")
          .where("document.id = :documentId", { documentId: documentId })
          .andWhere(`recommendation.id NOT IN (
              SELECT "recommendationId" FROM "change_log"
              WHERE "recommendationId" IS NOT NULL
            )`)
          .getMany();
    
        const docRepo = new DocumentRepository();
        const requestDocument = await docRepo.findDocumentById(documentId);
    
        if (!requestDocument) {
          return false;
        }
    
        // Initialize the response
        const response: any = {
          document: {
            doc_id: requestDocument.id,
            doc_content: requestDocument.docContentUrl,
            bytes: [] // This will hold bytes and their recommendations
          }
        };
    
        // Organize recommendations by byte
        const byteRecommendationsMap = new Map<any, { byteId: any, recommendations: any[] }>();
    
        if (recommendationsForDocument && recommendationsForDocument.length > 0) {
          for (let recommendation of recommendationsForDocument) {
            if (recommendation && recommendation.byte) {
              const byte = recommendation.byte; // Assuming each recommendation is associated with a byte
              const byteId = byte ? byte.id : null; // Set byteId to null if no byte is associated
    
              // Initialize byte recommendation structure with byteId (or null) if not already present
              if (!byteRecommendationsMap.has(byteId)) {
                byteRecommendationsMap.set(byteId, {
                  byteId: byteId, // Will be null if no byte exists
                  recommendations: [] // Recommendations will be grouped here
                });
              }
    
              // Safely get the byte object from the map (since we ensured it exists above)
              const byteEntry = byteRecommendationsMap.get(byteId)!; // Using non-null assertion here
    
              // Parse the recommendation JSON if it exists
              const recommendationJson = JSON.parse(recommendation?.recommendation || '{}');
    
              // Add the recommendation under the byte (or null byteId)
              if (recommendation) {
                byteEntry.recommendations.push({
                  id: recommendation.id,
                  change_request_type:
                    recommendation?.recommendationAction === 'new_section' ||
                    recommendation?.recommendationAction === 'add'
                      ? 'Add'
                      : 'Replace',
                  change_request_text: recommendationJson?.generated_text,
                  previous_string:
                    recommendationJson?.text_relevancy == 0
                      ? ''
                      : recommendationJson?.splitted_content,
                  section_main_heading1: recommendationJson?.section_main_heading1,
                  section_main_heading2: recommendationJson?.section_main_heading2,
                  section_main_heading3: recommendationJson?.section_main_heading3,
                  section_main_heading4: recommendationJson?.section_main_heading4
                });
              }
            }
          }
    
          // Add all bytes and their recommendations to the response
          response.document.bytes = Array.from(byteRecommendationsMap.values());
        }
    
        // Now the response is ready and properly organized by byte (or null byteId)
        return response;
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        throw new Error('Failed to fetch recommendations');
      }
    }

    async getRecommendations(byte: Partial<Byte>,teamspaceIds?: number []) {
      try {
        // Fetch recommendations that are not present in change_log
        const queryBuilder = this.recommendationRepo
          .createQueryBuilder("recommendation")
          .leftJoinAndSelect("recommendation.document", "document")
          .where("recommendation.byteId = :byteId", { byteId: byte?.id })
          .andWhere(`recommendation.id NOT IN (
              SELECT "recommendationId" FROM "change_log"
              WHERE "recommendationId" IS NOT NULL
            )`);

        if (teamspaceIds && teamspaceIds.length > 0) {
          queryBuilder.andWhere("document.teamspace IN (:...teamspaceIds)", { teamspaceIds });
        }

        const recommendationsForByte = await queryBuilder.getMany();
        console.log('recommendationsForByte--',recommendationsForByte)
        console.log(recommendationsForByte);
        console.log('recommendationsForByte--',recommendationsForByte)
        const response: any = {
          request_id: byte.id,
          request_text: byte.byteInfo,
          sender: byte?.requestedBy?.email,
          date_time: byte?.createdAt,
          documents: []
        };
    
        const documentMap = new Map(); // Map to group recommendations by document
    
        if (recommendationsForByte && recommendationsForByte.length > 0) {
          for (let recommendationByte of recommendationsForByte) {
            const recommendationJson = JSON.parse(recommendationByte?.recommendation);
    
            // Check if the document already exists in the response
            if (!documentMap.has(recommendationByte.document.id)) {
              // Add a new document entry if it doesn't exist
              documentMap.set(recommendationByte.document.id, {
                doc_id: recommendationByte.document.id,
                doc_content: recommendationByte.document.docContentUrl,
                recommendations: []
              });
            }
    
            // Add the recommendation to the corresponding document
            documentMap.get(recommendationByte.document.id).recommendations.push({
              id: recommendationByte.id,
              change_request_type: (recommendationByte?.recommendationAction == 'new_section' || recommendationByte?.recommendationAction == 'add') ? 'Add' : 'Replace',
              change_request_text: recommendationJson?.generated_text,
              previous_string: recommendationJson?.splitted_content,
              section_main_heading1: recommendationJson?.section_main_heading1,
              section_main_heading2: recommendationJson?.section_main_heading2,
              section_main_heading3: recommendationJson?.section_main_heading3,
              section_main_heading4: recommendationJson?.section_main_heading4,
            });
          }
        }
    
        // Convert the map to an array of documents
        response.documents = Array.from(documentMap.values());
    
        return response;
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
}