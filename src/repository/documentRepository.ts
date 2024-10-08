import { Repository } from 'typeorm';
import { AppDataSource } from '../db/data_source';  // Import your data source
import { Document } from '../entities/document';  // Import your Document entity
import { Folder } from '../entities/folder';

export class DocumentRepository {
    private documentRepo: Repository<Document>;
    private folderRepo: Repository<Folder>;

    constructor() {
        this.documentRepo = AppDataSource.getRepository(Document);  // Get the Document repository from the AppDataSource
        this.folderRepo = AppDataSource.getRepository(Folder);  // Get the Document repository from the AppDataSource
    }

    async findFoldersByClientId(clientId: number): Promise<Folder[]> {
        return await this.folderRepo.find({
          where: {
            client: { id: clientId },
          },
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
           where: { id: docId },relations:['client']});
    }

    // Find a document by its Doc Url
    async findDocumentByDocUrl(docContentUrl: string): Promise<Document | null> {
        return await this.documentRepo.findOne({ 
            where: {
                docContentUrl
            }  
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
        await this.documentRepo.delete(docId);
    }

    // CRUD for Folders
    async createFolder(folder: any): Promise<Folder> {
        return this.folderRepo.save(folder);
    }

    async getFolderById(id: number): Promise<Folder | null> {
        return this.folderRepo.findOne({ where: { id }, relations: ['client'] });
    }

    async updateFolder(id: number, folderData: Partial<Folder>): Promise<Folder | null> {
        console.log(id,folderData)
        await this.folderRepo.update({id}, folderData);
        return this.getFolderById(id);
    }

    async deleteFolder(id: number): Promise<void> {
        await this.folderRepo.delete(id);
    }

}