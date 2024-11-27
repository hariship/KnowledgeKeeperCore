export const OAUTH_PROVIDERS = {
    GOOGLE : 'GOOGLE',
    MICROSOFT : 'MICROSOFT',
    APPLE : 'APPLE',
    LOCAL: 'LOCAL'
}

export const GOOGLE_OAUTH_URL = `https://www.googleapis.com/oauth2/v3/tokeninfo`

export const MESSAGES = {
    USER :{
        REGISTRATION : {
            SUCCESS: 'UserDetails registered successfully',
            FAILURE: 'Error registering user'
        },
        LOGIN : {
            SUCCESS: 'Logged in successfully',
            FAILURE : 'Error logging into the portal'
        }
    }
}

export const RABBIT_MQ = {
    DOCUMENT_UPLOADED: 'document-uploaded'
}

export const STATUS = {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED'
}

export const TASK_NAMES = {
    SPLIT_DATA_INTO_CHUNKS : 'split_data_into_chunks_task',
    RECOMMEND_BYTES: 'recommend_bytes',
    UPDATE_DATA_INTO_CHUNKS: 'update_data_into_chunks_task'
}