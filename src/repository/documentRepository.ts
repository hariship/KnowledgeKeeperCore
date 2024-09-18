import { Repository } from 'typeorm';
import { AppDataSource } from '../db/data_source';  // Import your data source
import { Document } from '../entities/document';  // Import your Document entity

export class DocumentRepository {
    private documentRepo: Repository<Document>;

    constructor() {
        this.documentRepo = AppDataSource.getRepository(Document);  // Get the Document repository from the AppDataSource
    }

    // Create and save a new document
    async createDocument(document: Partial<Document>): Promise<Document> {
        const newDocument = this.documentRepo.create(document);
        return await this.documentRepo.save(newDocument);
    }

    // Find a document by its ID
    async findDocumentById(docId: number): Promise<Document | null> {
        return await this.documentRepo.findOneBy({ id: docId });
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
}