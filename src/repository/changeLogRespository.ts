import { Repository } from 'typeorm';
import { ChangeLog } from '../entities/change_logs';
import { AppDataSource } from '../db/data_source';
import { KnowledgeKeeperError } from '../errors/errors';
import { KNOWLEDGE_KEEPER_ERROR } from '../errors/errorConstants';

export class ChangeLogRepository{

 private changeLogRepo: Repository<ChangeLog>;

 constructor() {
    this.changeLogRepo = AppDataSource.getRepository(ChangeLog);  // Get the Document repository from the AppDataSource
}

  // Create a new change log entry
  async create(
    userId: number,
    docId: number,
    byteId: number,
    changeRequestType: string,
    changes: Array<{
      externalAttributeId: string;
      sectionHeadingType: string;
      sectionHeadingText: string;
      sectionContent: string;
    }>,
    changeSummary: string,
    isTrained: boolean
  ): Promise<ChangeLog> {
    const changeLog = this.changeLogRepo.create({
      document: { id: docId }, // Assuming Document entity is related via ManyToOne
      byte: { id: byteId }, // Assuming Byte entity is related via ManyToOne
      changedBy: { id: userId }, // Assuming UserDetails entity is related via ManyToOne
      changeRequestType,
      changeSummary,
      sectionHeadingType: changes[0].sectionHeadingType, // Assuming only one change is provided for simplicity
      sectionHeadingText: changes[0].sectionHeadingText,
      sectionContent: changes[0].sectionContent,
      externalAttributeId: changes[0].externalAttributeId,
      isTrained,
    });
    return await this.changeLogRepo.save(changeLog);
  }

  async createChangeLog(
    userId: number,
    docId: number,
    byteId: number,
    changeRequestType: string,
    changes: Array<{
      externalAttributeId: string;
      sectionHeadingType: string;
      sectionHeadingText: string;
      sectionContent: string;
    }>,
    changeSummary: string,
    isTrained: boolean
  ): Promise<any> {
    try {
      await this.create(
        userId,
        docId,
        byteId,
        changeRequestType,
        changes,
        changeSummary,
        isTrained,
      );
      return {
        status: 'success',
        message: 'Change log created successfully',
      };
    } catch (error) {
      console.error('Error creating change log:', error);
      return new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.INTERNAL_SERVER_ERROR);
    }
  }

  // Retrieve change logs based on a document or user
  async getChangeLogsByDocument(docId: number): Promise<ChangeLog[]> {
    return await this.changeLogRepo.find({
      where: { document: { id: docId } },
      relations: ['document', 'changedBy', 'byte'],
    });
  }

  async getChangeLogsByUser(userId: number): Promise<ChangeLog[]> {
    return await this.changeLogRepo.find({
      where: { changedBy: { id: userId } },
      relations: ['document', 'changedBy', 'byte'],
    });
  }
}