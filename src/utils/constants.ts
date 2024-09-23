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