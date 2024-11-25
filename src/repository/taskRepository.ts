import { In, Not, Repository } from "typeorm";
import { Task } from "../entities/task";
import { AppDataSource } from "../db/data_source";
import axios from 'axios';
import { STATUS, TASK_NAMES } from "../utils/constants";
import { DocumentRepository } from "./documentRepository";
import { ByteRepository } from "./byteRepository";
import { ChangeLog } from "../entities/change_logs";
import { Recommendation } from "../entities/recommendation";
const diff = require('diff');

export class TaskRepository {
    private taskRepo: Repository<Task>;
    private recommendationRepo: Repository<Recommendation>;
    private changeLogRepo: Repository<ChangeLog>

    constructor() {
        this.taskRepo = AppDataSource.getRepository(Task);
        this.recommendationRepo = AppDataSource.getRepository(Recommendation);
        this.changeLogRepo = AppDataSource.getRepository(ChangeLog);
    }

    async isPendingUserRecommendationForByte(byteId: number): Promise<any> {
        // Query for pending recommendations in ChangeLog associated with the byteId
        let pendingCount = 0;

        if(byteId){
            const recommendations:any = await this.recommendationRepo.find({
                where: {
                  byte: { id: byteId }
                },
                relations: ['byte']
              });
              console.log('recommendations',recommendations)
              const recommendationIds = recommendations.map((rec: { id: any; }) => rec.id);

              // Find all ChangeLog entries that have a matching recommendation
            const existingChangeLogs = await this.changeLogRepo.find({
                where: { recommendation: In(recommendationIds) },
                relations: ['recommendation']
            });

            // Get all IDs from existing ChangeLogs
            const loggedRecommendationIds = new Set(existingChangeLogs.map(log => log.recommendation.id));

            // Calculate the pending count as the recommendations that don't have a ChangeLog
            pendingCount = recommendationIds.filter((id: number) => !loggedRecommendationIds.has(id)).length;
            console.log(pendingCount)
        }  
        return {
            isPending: pendingCount > 0 ? true : false,
            noOfRecommendationsPending: pendingCount
        };
        

        // If there are pending recommendations, return true
        return  false;
      }

    public async isPendingTaskForByte(byteId:number){
        return this.taskRepo.findOne({
            where: {
              byteId,
              taskStatus: 'PENDING'
            }
          });
    }

    public async createTask(taskId: string, taskStatus: string, taskName: string, dataId?: string, byteId?: number){
        const taskRequest: Partial<Task> = {taskId,taskStatus,taskName}
        if(dataId){
            taskRequest.dataId = dataId
        }
        if(byteId){
            taskRequest.byteId = byteId
        }
        const task = await this.taskRepo.create(taskRequest)
        return this.taskRepo.save(task)
    }

    public async updateTaskStatus(taskId: string, status: string, dataId?: string): Promise<void> {
        try {
            const task = await this.taskRepo.findOneBy({ taskId });
            if (task) {
                task.taskStatus = status;
                if(dataId){
                    task.dataId = dataId
                }
                await this.taskRepo.save(task);
                console.log(`Task ID: ${taskId} updated with status: ${status}`);
            } else {
                console.error(`Task with ID: ${taskId} not found`);
            }
        } catch (error:any) {
            console.error(`Error updating task ${taskId}:`, error.message);
            throw error;
        }
    }

    public async getPendingTasks(): Promise<Task[]> {
        try {
            // Find all tasks where status is PENDING or IN_PROGRESS
            const tasks = await this.taskRepo.find({
                where: [
                    { taskStatus: 'PENDING' },
                    { taskStatus: 'IN_PROGRESS' }
                ]
            });
            console.log(tasks)
            return tasks;
        } catch (error) {
            console.error('Error fetching pending tasks:', error);
            throw error;
        }
    }

    public async getMostRecentTaskByName(taskName: string): Promise<Task | null> {
        return this.taskRepo.createQueryBuilder('task')
            .where('task.taskName = :taskName', { taskName })
            .orderBy('task.createdAt', 'DESC')
            .getOne(); // Fetch the most recent task
    }

    public async wrapChangeRequestWithHeading(headingTag:any, headingContent:any, changeText:any, recommendationContent: any) {
        let previous_string = `<${headingTag}>${headingContent}</${headingTag}> ${changeText}`;
        recommendationContent.previous_string = previous_string
        return recommendationContent
    }
    
    // Function to find the best match from a list of elements based on change_request_text
    public async findBestMatch(elements:any, changeRequest:any) {
        let bestMatchElement = null;
        let highestSimilarityScore = 0;
    
        elements.forEach((element: { content: any; }) => {
            const changes = diff.diffWords(element.content, changeRequest);
            const similarityScore = changes.reduce((score: any, part: { added: any; removed: any; count: any; }) => {
                return part.added || part.removed ? score : score + part.count;
            }, 0);
    
            if (similarityScore > highestSimilarityScore) {
                highestSimilarityScore = similarityScore;
                bestMatchElement = element;
            }
        });
    
        return bestMatchElement;
    }
    
    // Main function to get wrapped content
    public async getWrappedContent(data: any) {
        const { change_request_text, previous_string } = data;
        const sectionHeadings = [
            { tag: 'h1', content: data.section_main_heading1 },
            { tag: 'h2', content: data.section_main_heading2 },
            { tag: 'h3', content: data.section_main_heading3 },
            { tag: 'h4', content: data.section_main_heading4 }
        ];
    
        // Filter out empty headings
        const filteredHeadings = sectionHeadings.filter(heading => heading.content);
    
        // Regular expression to match any HTML tag and its content
        const tagRegex = /<(\w+)[^>]*>(.*?)<\/\1>/gs;
    
        // Extract tags and their contents from previous_string
        const elements = [];
        let match;
        while ((match = tagRegex.exec(previous_string)) !== null) {
            elements.push({
                tag: match[1],  // HTML tag name, e.g., 'p', 'ul', 'li'
                content: match[0]  // Entire tag content, e.g., "<p>...</p>"
            });
        }
    
        // Find the best match for change_request_text in top-level elements
        let bestMatchElement:any = this.findBestMatch(elements, change_request_text);
    
        // If the best match is a <ul> tag, further check <li> elements individually
        if (bestMatchElement && bestMatchElement.tag === 'ul') {
            const liElements = [];
            const liRegex = /<li>(.*?)<\/li>/gs;
            let liMatch;
            while ((liMatch = liRegex.exec(bestMatchElement.content)) !== null) {
                liElements.push({
                    tag: 'li',
                    content: `<li>${liMatch[1]}</li>`
                });
            }
    
            const bestLiMatch = this.findBestMatch(liElements, change_request_text);
            if (bestLiMatch) {
                bestMatchElement = bestLiMatch;  // Override with best-matching <li> element
            }
        }
    
        // Apply headings based on `section_main_heading` values
        if (bestMatchElement && filteredHeadings.length > 0) {
            return this.wrapChangeRequestWithHeading(
                filteredHeadings[0].tag,
                filteredHeadings[0].content,
                bestMatchElement.content,
                data
            );
        } else {
            return data;
        }
    }
    

    async pollTaskStatus(){
        try {
            // Get all tasks with status PENDING or IN_PROGRESS
            const pendingTasks = await this.getPendingTasks();
    
            for (const task of pendingTasks) {
                console.log('Poliing for task:', task)
                const response = await axios.get(`http://18.116.66.245:9100/v1/task_status/${task.taskId}`, {
                    headers: {
                        'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499' // Replace with actual token
                    }
                });
    
                const reponseTaskStatus = response.data.status;
                const taskName = response.data.task_name;
                const result = response.data.result;
    
                console.log(`Task ${task.taskId} status: ${reponseTaskStatus}`);
    
                if (task.taskStatus == STATUS.PENDING && reponseTaskStatus === STATUS.COMPLETED && taskName === TASK_NAMES.SPLIT_DATA_INTO_CHUNKS) {
                    // Update task status in the DB
                    await this.updateTaskStatus(task.taskId, reponseTaskStatus);

                    // Once the task is completed, update the documents
                    const { parsed_document, db_path } = result;
    
                    // Update documents with parsed_document and db_path
                    const documentRepo = new DocumentRepository();
                    await documentRepo.updateDocumentsWithParsedData(parsed_document, db_path);
    
                    console.log(`Documents updated with parsed data for task: ${task.taskId}`);
                }else if(task.taskStatus == STATUS.PENDING && reponseTaskStatus === STATUS.COMPLETED && taskName === TASK_NAMES.RECOMMEND_BYTES) {
                    // Update task status in the DB
                    await this.updateTaskStatus(task.taskId, reponseTaskStatus);

                    // Once the task is completed, update the documents
                    const { parsed_document, db_path } = result;
    
                    // Update documents with parsed_document and db_path
                    const byteRepo = new ByteRepository();
                    await byteRepo.saveRecommendations(result, task.byteId);
                    await byteRepo.updateByte(task.byteId, { isProcessedByRecommendation: true});
    
                    console.log(`Documents updated with parsed data for task: ${task.taskId}`);
                }
            }
        } catch (error:any) {
            console.error('Error polling task status:', error.message);
        }
    };

}