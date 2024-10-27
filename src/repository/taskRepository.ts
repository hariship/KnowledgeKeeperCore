import { Repository } from "typeorm";
import { Task } from "../entities/task";
import { AppDataSource } from "../db/data_source";
import axios from 'axios';
import { STATUS, TASK_NAMES } from "../utils/constants";
import { DocumentRepository } from "./documentRepository";
import { ByteRepository } from "./byteRepository";

export class TaskRepository {
    private taskRepo: Repository<Task>;

    constructor() {
        this.taskRepo = AppDataSource.getRepository(Task);
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

    async pollTaskStatus(){
        try {
            // Get all tasks with status PENDING or IN_PROGRESS
            const pendingTasks = await this.getPendingTasks();
    
            for (const task of pendingTasks) {
                console.log('Poliing for task:', task)
                const response = await axios.get(`http://18.116.66.245:5000/v1/task_status/${task.taskId}`, {
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
    
                    console.log(`Documents updated with parsed data for task: ${task.taskId}`);
                }
            }
        } catch (error:any) {
            console.error('Error polling task status:', error.message);
        }
    };

}