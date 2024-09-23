export const KNOWLEDGE_KEEPER_ERROR = {
    USER_EXISTS: {
        HTTP_STATUS: 400,
        ERROR_CODE: 'User already exists',
        ERROR_MESSAGE: 'User has already been registered'
    },
    VALIDATION_ERROR: {
        HTTP_STATUS: 400,
        ERROR_CODE: 'VALIDATION_ERROR',
        ERROR_MESSAGE: 'Invalid input data',
    },
    NOT_FOUND: {
        HTTP_STATUS: 404,
        ERROR_CODE: 'NOT_FOUND',
        ERROR_MESSAGE: 'Resource not found',
    },
    AUTHENTICATION_ERROR: {
        HTTP_STATUS: 401,
        ERROR_CODE: 'AUTHENTICATION_ERROR',
        ERROR_MESSAGE: 'User email and token/password does not match',
    },
    AUTHORIZATION_ERROR: {
        HTTP_STATUS: 403,
        ERROR_CODE: 'AUTHORIZATION_ERROR',
        ERROR_MESSAGE: 'You are not authorized to access this resource',
    },
    INTERNAL_SERVER_ERROR: {
        HTTP_STATUS: 500,
        ERROR_CODE: 'INTERNAL_SERVER_ERROR',
        ERROR_MESSAGE: 'Internal server error',
    },
    CLIENT_NOT_FOUND: {
        HTTP_STATUS: 400,
        ERROR_CODE: 'Invalid or bad clientId',
        ERROR_MESSAGE: 'Provided clientId does not exist'
    }
};