import { Router } from 'express';
import { UserRepository } from '../repository/userRepository';
import bcrypt from 'bcrypt';
import { generateToken } from '../modules/userModule';
import axios from 'axios';
import { GOOGLE_OAUTH_URL, MESSAGES, OAUTH_PROVIDERS } from '../utils/constants';
import { KnowledgeKeeperError } from '../errors/errors';
import { KNOWLEDGE_KEEPER_ERROR } from '../errors/errorConstants';
import { authenticate } from '../modules/authModule';

const router = Router();
const userRepository = new UserRepository(); // Initialize the repository


router.get('/slack/callback', async (req, res) => {
  const code = req.query.code;
  
  const slackClientId = '7270388447441.7774073893426';
  const slackClientSecret = '99bcc2858d7d9f40792e21faf6b7f90b';
  const redirectUri = 'https://api-core-develop.knowledgekeeper.ai/api/v1/auth/slack/callback'; // Your redirect URL

  try {
    // Exchange the authorization code for an access token
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: slackClientId,
        client_secret: slackClientSecret,
        code: code,
        redirect_uri: redirectUri
      }
    });
    
    const { access_token, team } = response.data;
    
    if (response.data.ok) {
      // Store the access token and team details in your database
      console.log(`Access token: ${access_token}`);
      console.log(`Team info:`, team);

      // Redirect or show a success message to the user
      res.send("Slack app installed successfully!");
    } else {
      res.status(500).send("Slack OAuth failed");
    }
  } catch (error) {
    console.error("Error in Slack OAuth callback:", error);
    res.status(500).send("Error during Slack OAuth");
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: "Log in a user with email/password or OAuth provider"
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 description: "The user's email address"
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 description: "The user's password"
 *                 example: "password123"
 *               oAuthProvider:
 *                 type: string
 *                 description: "The OAuth provider, if using OAuth login (e.g., 'GOOGLE', 'FACEBOOK', etc.)"
 *                 example: "GOOGLE"
 *               oAuthToken:
 *                 type: string
 *                 description: "OAuth token for third-party login"
 *                 example: "oauth-token-here"
 *     responses:
 *       200:
 *         description: "Successful login"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logged in successfully"
 *                 token:
 *                   type: string
 *                   description: "JWT token"
 *                   example: "JWT_token_here"
 *       400:
 *         description: "Invalid email or password"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid email or password"
 */
router.post('/login', authenticate, async (req, res, next) => {
  const { email, password, oAuthProvider, oAuthToken } = req.body;

  try {
      let user: any;
      let response:any = {};

      if (oAuthProvider && oAuthProvider !== OAUTH_PROVIDERS.LOCAL) {
          // Handle OAuth login
          let oAuthUserData;

          if (oAuthProvider === OAUTH_PROVIDERS.GOOGLE) {
            //   try {
            //       // Validate Google OAuth token and get user data
            //       const googleOauthUrl = `${GOOGLE_OAUTH_URL}?id_token=${oAuthToken}`
            //       const googleOauthResponse = await axios.get(googleOauthUrl);

            //       console.log(googleOauthResponse)

            //       oAuthUserData = googleOauthResponse.data;

            //       console.log(oAuthUserData)

            //       if (!oAuthUserData || !oAuthUserData.email) {
            //         console.log(oAuthUserData)
            //         throw new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.AUTHENTICATION_ERROR);
            //     }

            //   } catch (error) {
            //       throw new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.AUTHENTICATION_ERROR);
            //   }
          }else if (oAuthProvider == OAUTH_PROVIDERS.MICROSOFT || oAuthProvider === OAUTH_PROVIDERS.APPLE){
            // Add apple authentication
          }
          // Add more providers here (e.g., Apple, Microsoft)

          // Find user by OAuth provider
          user = await userRepository.findUserByOAuthProvider(email, oAuthProvider);
          console.log(user)
          if (!user) {
              response = new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.NOT_FOUND);
          }

      } else {
          // Handle manual login
          if (!email || !password) {
            response = new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.VALIDATION_ERROR);
          }

          // Find user by email
          user = await userRepository.findUserByEmail(email);
          if (!user) {
            response = new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.NOT_FOUND);
          }else{
            // Validate password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                response = new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.AUTHENTICATION_ERROR);
            }
          }

      }

      // Generate JWT token
      if(!response.errorCode){
        const token = generateToken(user);
        response = { 
            status: 'success', 
            message: MESSAGES.USER.LOGIN.SUCCESS, 
            token,
            userId: user?.id
          }
      }
      res.json(response);

  } catch (error) {
      next(error); // Pass the error to the error handler middleware
  }
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: "Register a new user with email and password or using an OAuth provider"
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *                 description: "The user's email address"
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 description: "The user's password"
 *                 example: "password123"
 *               username:
 *                 type: string
 *                 description: "The user's username"
 *                 example: "user123"
 *               oAuthProvider:
 *                 type: string
 *                 description: "OAuth provider (if using third-party login)"
 *                 example: "GOOGLE"
 *               oAuthToken:
 *                 type: string
 *                 description: "OAuth token for third-party login"
 *                 example: "oauth-token-here"
 *     responses:
 *       200:
 *         description: "Successful registration"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "UserDetails registered successfully"
 *                 userId:
 *                   type: integer
 *                   example: 1
 *       400:
 *         description: "Email already exists"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email already exists"
 */
router.post('/register',authenticate, async (req, res, next) => {
  let { email, password, username, oAuthProvider, oAuthToken } = req.body;

  try {
      let user;
      let response:any = {}


      if (oAuthProvider && oAuthProvider !== OAUTH_PROVIDERS.LOCAL) {
          // Handle OAuth registration
          let oAuthUserData;

          if (oAuthProvider === OAUTH_PROVIDERS.GOOGLE) {
            //   try {
            //       // Validate Google OAuth token and get user data
            //       const googleResponse = await axios.get(`${GOOGLE_OAUTH_URL}?id_token=${oAuthToken}`);
            //       oAuthUserData = googleResponse.data;

            //       console.log(oAuthUserData)

            //       if (!oAuthUserData || !oAuthUserData.email) {
            //         throw new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.AUTHENTICATION_ERROR);
            //     }
            //   } catch (error) {
            //       throw new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.VALIDATION_ERROR);
            //   }
          }else if (oAuthProvider == OAUTH_PROVIDERS.MICROSOFT || oAuthProvider === OAUTH_PROVIDERS.APPLE){
            // Add apple authentication
          }

          if(!oAuthProvider){
            oAuthProvider = OAUTH_PROVIDERS.LOCAL
          }

          // Check if the user already exists with this OAuth provider
          user = await userRepository.findUserByOAuthProvider(email, oAuthProvider);
          if (user) {
              response = new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.USER_EXISTS);
          }

          // Create new user with OAuth provider
          user = await userRepository.createUser({
              email: email,
              oAuthProvider: oAuthProvider,
          });

      } else {
          // Handle manual registration
          console.log(email,password)
          if (!email || !password) {
            response = new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.VALIDATION_ERROR);
          }

          // Check if the user already exists with this email
          const userExists = await userRepository.findUserByEmail(email);
          if (userExists) {
              response = new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.USER_EXISTS);
          }

          // Hash the password and create the user
          const hashedPassword = await bcrypt.hash(password, 10);
          user = await userRepository.createUser({
              email,
              password: hashedPassword,
              oAuthProvider: OAUTH_PROVIDERS.LOCAL,
          });
      }

      // Generate JWT token for the user
      if(!response.errorCode){
        const token = generateToken(user);

        response = { 
            status: 'success', 
            message: MESSAGES.USER.REGISTRATION.SUCCESS, 
            token,
            userId: user?.id
          }
      }

      res.json(response);
  } catch (error) {
      next(error); 
  }
});

export default router;