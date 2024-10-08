// src/errors/KnowledgeKeeperError.ts

export class KnowledgeKeeperError extends Error {
    public statusCode: number;
    public errorCode: string;
    public status: string;

    constructor(errorObj: { HTTP_STATUS: number; ERROR_CODE: string; ERROR_MESSAGE: string }) {
        super(errorObj.ERROR_MESSAGE);
        this.statusCode = errorObj.HTTP_STATUS;
        this.errorCode = errorObj.ERROR_CODE;
        this.name = 'KnowledgeKeeperError';
        this.status = 'failed';
        Error.captureStackTrace(this, this.constructor);
    }
}