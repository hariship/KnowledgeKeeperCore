import { Repository } from 'typeorm';
import { AppDataSource } from '../db/data_source';  // Import your data source
import { Document } from '../entities/document';  // Import your Document entity
import { Folder } from '../entities/folder';
import axios from 'axios';
import { Task } from '../entities/task';
import { TaskRepository } from './taskRepository';
import { STATUS, TASK_NAMES } from '../utils/constants';
import { ByteRepository } from './byteRepository';
import { Recommendation } from '../entities/recommendation';
import { Byte } from '../entities/byte';
const { v4: uuidv4 } = require('uuid');

export class DocumentRepository {
    private documentRepo: Repository<Document>;
    private folderRepo: Repository<Folder>;

    constructor() {
        this.documentRepo = AppDataSource.getRepository(Document);  // Get the Document repository from the AppDataSource
        this.folderRepo = AppDataSource.getRepository(Folder);  // Get the Document repository from the AppDataSource
    }

    public async isUniqueDocumentNameByFolder(folderId:number,documentName: string){
       const documentExists = await this.documentRepo.findOne({
            where: {
              folder: { id: folderId },
              documentName: documentName
            },
            relations:['folder']
          });


        return documentExists;
    }

    public async updateDocumentsWithParsedData(parsedDocument: string, dbPath: string): Promise<void> {
        try {
            const documents = await this.getAllDocuments();

            for (const document of documents) {
                document.s3SentencedDocumentPath = parsedDocument;
                document.s3DBPath = dbPath;
                await this.documentRepo.save(document); // Save each updated document
            }
        } catch (error) {
            console.error('Error updating documents with parsed data:', error);
            throw error;
        }
    }

    async findFoldersByClientId(clientId: number,teamspaceId?: number): Promise<Folder[]> {
        let requestBody:any = {
            client: { id: clientId },
        }
        if(teamspaceId){
            requestBody.teamspaceId = teamspaceId
        }
        return await this.folderRepo.find({
          where: requestBody,
          relations: ['client'], // Fetch related client information
        });
      }

    // Find document by both clientId and docId
    async findDocumentByClientAndId(clientId: number, docId: number): Promise<Document | null> {
        return await this.documentRepo.findOne({
            where: { id: docId, client: { id: clientId } },
            relations: ['client', 'folder', 'createdBy', 'updatedBy'],
        });
    }

    // Create and save a new document
    async createDocument(document: Partial<Document>): Promise<Document> {
        const newDocument = this.documentRepo.create(document);
        return await this.documentRepo.save(newDocument);
    }

    // Find a document by its ID
    async findDocumentById(docId: number): Promise<Document | null> {
        return await this.documentRepo.findOne({
           where: { id: docId },relations:['client', 'teamspace']});
    }

    // Find a document by its Doc Url
    async findDocumentByDocUrl(docContentUrl: string): Promise<Document | null> {
        return await this.documentRepo.findOne({ 
            where: {
                docContentUrl
            },
            relations:['teamspace','client']
        });
    }

    // Update a document's details
    async updateDocument(docId: number, updatedData: Partial<Document>): Promise<Document | null> {
        await this.documentRepo.update(docId, updatedData);  // Update the document data
        return this.findDocumentById(docId);  // Return the updated document
    }

    // Get all documents for a specific client
    async findDocumentsByClient(clientId: number): Promise<Document[]> {
        return await this.documentRepo.find({
            where: {
                client: { id: clientId }
            },
            relations: ['client'],  // Load related client information if needed
        });
    }

    // Delete a document by ID
    async deleteDocument(docId: number): Promise<void> {
        await this.removeDocumentFromRecommendation(docId);
        await this.documentRepo.delete(docId);
    }

    private async removeDocumentFromRecommendation(docId: number): Promise<Boolean> {
        // Your logic to remove the document from the recommendation system goes here
        // For example, you might call a service to update the recommendation system.
        const byteRepo = new ByteRepository();
        await byteRepo.deleteRecommendationByDocId(docId);
        return true;
    }

    // CRUD for Folders
    async createFolder(folder: any): Promise<Folder> {
        return this.folderRepo.save(folder);
    }

    async getFolderById(id: number,teamspaceId?:number): Promise<Folder | null> {
        let requestBody:any = {
            id
        }
        if(teamspaceId){
            requestBody.teamspaceId = teamspaceId
        }
        return this.folderRepo.findOne({ where: requestBody, relations: ['client','teamspace'] });
    }

    async updateFolder(id: number, folderData: Partial<Folder>): Promise<Folder | null> {
        console.log(id,folderData)
        await this.folderRepo.update({id}, folderData);
        return this.getFolderById(id);
    }

    async deleteFolder(id: number): Promise<void> {
         // Begin a transaction to ensure all or nothing gets deleted
        const queryRunner = this.folderRepo.manager.connection.createQueryRunner();
        await queryRunner.startTransaction();

        try {
            // Step 1: Delete all documents associated with the folder
            let documents = await this.documentRepo.find({
                where:{
                    folder: {
                        id
                    }
                },
                relations: ['folder']
            })
            for(let document of documents){
                const byteRepo = new ByteRepository();
                await byteRepo.deleteRecommendationByDocId(document.id)
            }
            
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from("document")
                .where("folderId = :folderId", { folderId: id })
                .execute();

            // Step 2: Delete the folder itself
            await queryRunner.manager
                .createQueryBuilder()
                .delete()
                .from("folder")
                .where("id = :id", { id })
                .execute();

            // Commit the transaction
            await queryRunner.commitTransaction();
        } catch (error:any) {
            // Rollback the transaction in case of any error
            await queryRunner.rollbackTransaction();
            console.log(`Failed to delete folder and documents:`,error?.message)
        } finally {
            // Release the query runner
            await queryRunner.release();
        }
    }

    public async getAllDocuments(): Promise<Document[]> {
        try {
            // Fetch all documents from the DB
            const documents = await this.documentRepo.find();

            // Return the documents from the database
            return documents;
        } catch (error) {
            console.error('Error fetching documents:', error);
            throw error;
        }
    }

    public async callSplitDataIntoChunks(teamspaceName: string) {
        try {
            const documents = await this.getAllDocuments();

            if (documents.length > 0) {
                const s3DocumentPaths = documents.map(doc => ({
                    document_id: doc.id.toString(),
                    s3_path: doc.s3Path
                }));

                console.log('s3DocumentPaths',s3DocumentPaths)

                const splitDataIntoChunksRequest = {
                    data_id: uuidv4(),
                    s3_document_path: s3DocumentPaths,
                    s3_bucket: "knowledge-keeper-results",
                    teamspace_name: teamspaceName,
                    s3_db_path: "data/test/",
                    teamspace_s3_path: "data/test/"
                };

                // Call the split_data_into_chunks API
                const response = await axios.post('http://3.142.50.84:5000/v1/split_data_into_chunks', splitDataIntoChunksRequest, {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499' // Replace with your API token
                    }
                });

                // Assuming the API returns task_id
                const { task_id } = response.data;
                console.log(`Task created with ID: ${task_id}`);

                // Update task table with the task_id and status (PENDING)
                const taskRepo = new TaskRepository();
                const taskName = TASK_NAMES.SPLIT_DATA_INTO_CHUNKS;
                const dataId = uuidv4();
                await taskRepo.createTask(task_id, STATUS.PENDING, taskName, dataId);
            } else {
                console.log('No new or modified documents found.');
            }
        } catch (error:any) {
            console.log(error)
            console.error('Error calling split_data_into_chunks:', error.message);
        }
    }

}