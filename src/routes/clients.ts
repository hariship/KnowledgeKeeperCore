import { Request, Response, Router } from 'express';
import { AppDataSource } from '../db/data_source';
import { Document } from '../entities/document'; // Your document entity
import { diffWordsWithSpace } from 'diff';
import multer from 'multer';
import { extractHeadersFromHtml, sendMessageToRabbitMQ, uploadImageToS3, uploadToS3 } from '../modules/s3Module';
import { DocumentRepository } from '../repository/documentRepository';
import { ClientRepository } from '../repository/clientRepository';
import { KnowledgeKeeperError } from '../errors/errors';
import { KNOWLEDGE_KEEPER_ERROR } from '../errors/errorConstants';
import { authenticate, verifyToken } from '../modules/authModule';
import { ByteRepository } from '../repository/byteRepository';
import { UserRepository } from '../repository/userRepository';
import { UserDetails } from '../entities/user_details';
import { ChangeLogRepository } from '../repository/changeLogRespository';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TeamspaceRepository } from '../repository/teamspaceRepository';
import { Folder } from '../entities/folder';
import { TaskRepository } from '../repository/taskRepository';
import { UserTeamspaceRepository } from '../repository/userTeamspaceRepository';
import { UserTeamspace } from '../entities/user_teamspace';
import { getStructuredHTMLDiff } from '../modules/userModule';
import { TeamspaceChannelsRepository } from '../repository/teamspaceChannelsRepository';
import { SlackRepository } from '../repository/slackRepository';
const { v4: uuidv4 } = require('uuid');

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Store in memory for easy access
const documentRepository = new DocumentRepository();


/**
 * @swagger
 * /clients/users/exists:
 *   post:
 *     summary: Check if a user exists
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: The email of the user to check
 *     responses:
 *       200:
 *         description: Returns whether the user exists or not
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   description: True if the user exists, false otherwise
 *       400:
 *         description: Invalid email provided
 *       500:
 *         description: Server error
 */
router.post('/users/exists', authenticate, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const userRepository = new UserRepository();
    // Check if the user exists
    const exists = await userRepository.isUserExists(email);
    
    // Return the result
    return res.status(200).json({ exists });
  } catch (error: any) {
    console.error('Error checking if user exists:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @swagger
 * /clients/load-document:
 *   post:
 *     summary: "Upload an HTML document to S3, extract headers, and place a request in RabbitMQ"
 *     tags:
 *       - Document Management
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "The HTML file to upload"
 *               clientId:
 *                 type: integer
 *                 description: "The client ID associated with the document"
 *               docId:
 *                 type: integer
 *                 description: "The document id associated with the document"
 *               documentName:
 *                 type: string
 *                 description: "The document name associated with the document"
 *               clientName:
 *                 type: string
 *                 description: "The client name associated with the document"
 *               folderId:
 *                 type: integer
 *                 description: "The folderId associated with the document"
 *               folderName:
 *                 type: string
 *                 description: "The folder name associated with the document"
 *               teamspaceId:
 *                 type: integer
 *                 description: "The teamspaceId associated with the document"
 *     responses:
 *       200:
 *         description: "Document uploaded successfully"
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
 *                   example: "Document uploaded successfully"
 *                 document:
 *                   type: object
 *                   properties:
 *                     docId:
 *                       type: integer
 *                       example: 123
 *                     versionNumber:
 *                       type: number
 *                       example: 1.0
 *                     docUrl:
 *                       type: string
 *                       example: "https://bucket-name.s3.region.amazonaws.com/file-name"
 *                     clientId:
 *                       type: integer
 *                       example: 456
 *       400:
 *         description: "Bad request - Missing file, clientId or clientName"
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
 *                   example: "No file uploaded"  
 *       500:
 *         description: "Internal server error"
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
 *                   example: "Server error"
 */
router.post('/load-document', verifyToken, upload.single('file'), async (req: Request, res: Response) => {
  const file = req?.file;

  if (!file) {
    return res.status(400).json({ status: false, message: 'No file uploaded' });
  }

  try {
    let clientId = req.body?.clientId;
    let clientName = req.body?.clientName;
    let folderId = parseInt(req.body.folderId, 10);
    let folderName = req.body?.folderName;
    let documentName = req?.body?.documentName;
    let docId = req?.body?.documentId;
    let teamspaceName = req?.body?.teamspaceName;

    let client: any = {};

    if (!clientName && !clientId) {
      return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.BAD_CLIENT_REQUEST));
    }

    const documentRepo = new DocumentRepository();
    const clientRepo = new ClientRepository();

    if (clientId) {
      const clientFound = await clientRepo.findClientById(clientId);
      if (!clientFound || Object.values(clientFound).every(value => value === null)) {
        return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.CLIENT_NOT_FOUND));
      }
      client = clientFound;
    } else if (clientName) {
      const clientFound = await clientRepo.findClientByName(clientName);
      client = clientFound || await clientRepo.createClient(clientName);
    }

    clientId = client?.id;
    clientName = client.clientName;

    let folder: any;
    if (folderId) {
      folder = await documentRepo.getFolderById(folderId);
      if (!folder) {
        return res.json({ status: false, message: 'No folder found with the id' });
      }
    } else if (folderName && !teamspaceName) {
      const teamspaceRepo = new TeamspaceRepository();
      const teamspaceReq = {
        teamspaceName: folderName,
        isTrained: false,
        reTrainingRequired: false,
        totalNumberOfDocs: 0,
        client: clientId
      };
      const teamspace = await teamspaceRepo.createTeamspace(teamspaceReq);

      folder = await documentRepo.createFolder({
        folderName,
        isTrained: false,
        reTrainingRequired: false,
        totalNumberOfDocs: 0,
        client: clientId,
        teamspace
      });
    }


    // Calculate the difference between the new document (html1) and existing document (html2)
    const html1 = file.buffer.toString('utf-8');
    console.log(html1)
    // const differences = await getDiffWordsWithSpace(html1, html2)
    // Upload new file to S3
    // Fetch existing document (if any) from S3 to compare with the new one
    let html2 = '';
    let document:any;
    if(docId){
      document = await documentRepo.findDocumentById(parseInt(docId));
    }
    let isNewDocument = true;
    let differences:any = []
    
    if (document && document.docContentUrl) {
      // Use the existing document's S3 URL to fetch HTML content
      const response = await axios.get(document.docContentUrl);
      html2 = response.data;
      // Calculate the difference between the new document (html1) and existing document (html2)
      differences = await getStructuredHTMLDiff(html2, html1)
    }

    const s3Url = await uploadToS3(file, clientName);
    console.log(s3Url)

    const teamspace = folder ? folder.teamspace : document?.teamspace;

    let createdocumentRequest = {
      docContentUrl: s3Url,
      documentName,
      versionNumber: 1.0,
      isTrained: false,
      reTrainingRequired: false,
      updatedAt: new Date(),
      client: client,
      folder: folder,
      teamspace: teamspace
    };

    if (!document || Object.values(document).every(value => value === null)) {
      document = await documentRepo.createDocument(createdocumentRequest);
    }

    console.log(teamspace?.teamspaceName)

    const data_id = uuidv4();
    const dataExistsRequest  = {
      data_id,
      teamspace_name : teamspace?.teamspaceName,
      document_id : `${document?.id}`
    }
    // Check for pending task status and mark flag accordingly
    const response = await axios.post(`${process.env.ML_ENDPOINT}/v2/data_exists`, dataExistsRequest, {
      headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499' // Replace with your API token
      }
    });
    console.log(response.data)
    if(response.data.exists){
      isNewDocument = false
    }else{
      console.log(response.data)
      isNewDocument = true
    }

    if(folder){
      console.log(folder)
      folder = await documentRepo.updateFolder(folder?.id, {totalNumberOfDocs: folder?.totalNumberOfDocs + 1});
    }
    
    // // Step 3: Place a request in RabbitMQ
    // await sendMessageToRabbitMQ({
    //   docId: document.id,
    //   versionNumber: document.versionNumber,
    //   clientId,
    //   isTrained: false
    // });

    const regex = /https:\/\/[^\/]+\.com\/(.+)/;
    const match = s3Url.match(regex);

    if (match && match[1]) {
      const s3Path = match[1];
      await documentRepo.updateDocument(document.id, { s3Path });
    }

    // call split data into chunks
    if(isNewDocument){
      await documentRepo.callSplitDataIntoChunks(teamspace?.teamspaceName, differences, document?.id);
    }else{
      console.log(teamspace?.teamspaceName)
      await documentRepo.callUpdateDocumentDifference(teamspace?.teamspaceName, differences, document.id);
    }



    return res.json({
      status: true,
      message: 'Document uploaded successfully',
      document: {
        docId: document.id,
        versionNumber: document.versionNumber,
        docUrl: s3Url,
        clientId,
        folder
      }
    });
  } catch (error) {
    console.error('Error during document upload:', error);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
});


/**
 * components:
 * schemas:
 *   Folder:
 *     type: object
 *     properties:
 *       id:
 *         type: integer
 *         description: Unique ID of the folder
 *       folderName:
 *         type: string
 *         description: Name of the folder
 *       totalNumberOfDocs:
 *         type: integer
 *         description: Total number of documents in the folder
 *       isTrained:
 *         type: boolean
 *         description: Whether the folder's documents have been trained
 *       reTrainingRequired:
 *         type: boolean
 *         description: Whether re-training is required for this folder
 */


/**
 * @swagger
 * /clients/modify:
 *   post:
 *     summary: "Modify a document and log the changes"
 *     description: "This API allows users to modify a document and log the changes in the change log, with optional byte creation if not provided."
 *     tags:
 *       - ChangeLog
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: "The ID of the user requesting the modification"
 *                 example: 1
 *               docId:
 *                 type: integer
 *                 description: "The ID of the document being modified"
 *                 example: 123
 *               byteId:
 *                 type: integer
 *                 description: "The ID of the byte related to the modification, if already exists"
 *                 example: 456
 *                 nullable: true
 *               clientId:
 *                 type: integer
 *                 description: "The ID of the client related to the modification, if already exists"
 *                 example: 2
 *                 nullable: true
 *               byte:
 *                 type: string
 *                 description: "Optional byte information in case a new byte needs to be created"
 *                 example: "byte data here"
 *                 nullable: true
 *               changeRequestType:
 *                 type: string
 *                 description: "The type of request being performed, e.g., 'Update', 'Delete'"
 *                 example: "Update"
 *               changes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     externalAttributeId:
 *                       type: string
 *                       description: "The ID of the attribute being modified"
 *                       example: "attr123"
 *                     sectionHeadingType:
 *                       type: string
 *                       enum: [ "h1", "h2", "h3", "h4" ]
 *                       description: "The type of section heading being modified"
 *                       example: "h1"
 *                     sectionHeadingText:
 *                       type: string
 *                       description: "The text of the section heading"
 *                       example: "Introduction"
 *                     sectionContent:
 *                       type: string
 *                       description: "The content of the section"
 *                       example: "This is the updated content for the introduction section."
 *               changeSummary:
 *                 type: string
 *                 description: "A summary of the changes made to the document"
 *                 example: "Updated the introduction section with new content"
 *               isTrained:
 *                 type: boolean
 *                 description: "Indicates if the changes have been trained"
 *                 example: false
 *               recommendationId:
 *                 type: integer
 *                 description: "Unique id of the recommendation"
 *                 example: 2
 *               recommendationAction:
 *                 type: string
 *                 description: "The type of recommendaiton whether accepted or not logged"
 *                 example: ACCEPTED  
 *     responses:
 *       200:
 *         description: "Modification successful and logged"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Change log created successfully"
 *                 result:
 *                   type: object
 *                   description: "The change log created"
 *       400:
 *         description: "Bad request - Missing required fields or invalid data"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Missing required fields"
 *       500:
 *         description: "Internal server error"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Error creating change log"
 */
router.post('/modify', async (req: Request, res: Response) => {
  console.log(req.body)
  let { recommendationId, userId, docId, byteId,byteInfo, changeRequestType, changes, changeSummary, isTrained, clientId, recommendationAction } = req.body;

  // if (!userId || !docId || !changeRequestType || !changes || !changeSummary || !clientId) {
  //   return res.status(400).json({
  //     status: 'failed',
  //     message: 'Missing required fields',
  //   });
  // }
  let userDetails: any, docDetails:any, byteDetails:any; 

  if(userId){
    const userRepo = new UserRepository();
    userDetails = await userRepo.findUserById(userId)
  }

  if(docId){
    const documentRepo = new DocumentRepository();
    docDetails = await documentRepo.findDocumentById(docId)
  }

  if(!userDetails){
    return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.NOT_FOUND));
  }

  if(!docDetails){
    return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.DOCUMENT_NOT_FOUND));
  }

  if(!byteId){
    return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.BYTE_NOT_FOUND));
  }


  const byteRepo = new ByteRepository();
  byteDetails = await byteRepo.findByteById(byteId)

  if(!byteDetails){
    return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.BYTE_NOT_FOUND));
  }

  byteId = byteDetails?.id

  // Call the service to create the change log
  const changeLogRepo = new ChangeLogRepository();
  const result = await changeLogRepo.createChangeLog(
    userId,
    docId,
    byteId,
    changeRequestType,
    changes,
    changeSummary,
    isTrained,
    recommendationAction,
    recommendationId
  );

  // After logging the change, check the recommendationAction
  if (recommendationAction === 'ACCEPTED' || recommendationAction === 'REJECTED') {
    // Update the byte status to resolved

    let recommendationsForByte = await byteRepo.getRecommendations(byteDetails);
    console.log('recommendationsForByte---')
    console.log(recommendationsForByte)
    if(recommendationsForByte.documents.length == 0){
      // No more recommendations so update the byte as resolved
      const updatedByte = await byteRepo.updateByte(byteId, {status:'resolved'});
      if (!updatedByte) {
        return res.status(500).json({
          status: 'failed',
          message: 'Failed to update byte status',
        });
      }
    }else{
      // Update recommendation count here
      await byteRepo.updateByte(byteId, {noOfRecommendations:byteDetails?.noOfRecommendations - 1});
    }
    
    
  }

  return res.json(result);
});

/**
 * @swagger
 * /clients/{clientId}/bytes/open:
 *   get:
 *     tags:
 *       - Bytes
 *     summary: "Get all bytes with an open status and high recommendation count"
 *     description: "Returns a list of all bytes that are marked as 'open' and have a high recommendation count for a specific client."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the client whose open bytes need to be fetched
 *     responses:
 *       200:
 *         description: "Successfully retrieved all open bytes with high recommendation count."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/definitions/Byte'
 *       500:
 *         description: "Internal server error."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Server error"
 */


// Get all bytes with a status of 'open' and high recommendation counts
router.get('/:clientId/bytes/open', verifyToken, async (req:any, res) => {
  try {
    const clientId = req.params.clientId;
    let userId = req.user.userId
    console.log(userId)
    let userTeamspaceRepo = new UserTeamspaceRepository();
    const userTeampsaces = await userTeamspaceRepo.findTeamspacesForUser(userId);
    const teamspaceIds = userTeampsaces.map((userTeamspace)=> userTeamspace.teamspace.id)
    const byteRepo = new ByteRepository();
      const bytes = await byteRepo.findAllOpenWithHighRecommendations(parseInt(clientId),teamspaceIds);
      res.json({
          status: 'success',
          data: bytes
      });
  } catch (error) {
      res.status(500).json({ status: 'error', message: 'Failed to retrieve open bytes' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/bytes/{byteId}/resolve-or-closed:
 *   post:
 *     tags:
 *       - Bytes
 *     summary: "Mark a byte as resolved or closed"
 *     description: "Marks a specific byte as 'resolved' for a given client."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the client to which the byte belongs.
 *       - in: path
 *         name: byteId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the byte that needs to be marked as resolved.
 *     requestBody:
 *       description: Information to mark the byte as resolved.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userFeedback:
 *                 type: string
 *                 description: "Details about the resolution."
 *                 example: "The issue was resolved by updating the signal strength."
 *               resolutionDetails:
 *                 type: string
 *                 description: "Markes whether its was closed or resolved"
 *                 example: "resolved"
 *     responses:
 *       200:
 *         description: "Successfully marked the byte as resolved."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Byte has been marked as resolved."
 *       400:
 *         description: "Bad Request - Invalid parameters."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Invalid byteId or clientId."
 *       500:
 *         description: "Internal server error."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Server error"
 */

// POST: Mark a byte as resolved
router.post('/:clientId/bytes/:byteId/resolve-or-closed', verifyToken, async (req:any, res) => {
  try {
    const { byteId } = req.params;
    const {resolutionDetails, userFeedback} = req.body;
    const userId = req?.user?.userId

    const byteRepo = new ByteRepository();

    // Validate if the byte exists and belongs to the client
    const byte = await byteRepo.findByteById(parseInt(byteId));

    if (!byte) {
      return res.status(400).json({ status: 'error', message: 'Invalid byteId or clientId' });
    }

    // Mark byte as resolved and add resolution details
    byte.status = resolutionDetails;
    byte.userFeedback = userFeedback;
  
    if(resolutionDetails == 'resolved'){
      //mark all recommendations under that byte as closed by adding change_log
      await byteRepo.handleRecommendations(byte, userId)
    }
    await byteRepo.saveByte(byte); // Assuming save will update the byte in the database

    res.json({
      status: 'success',
      message: 'Change request has been resolved.'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to mark byte as resolved' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/documents/{docId}/upload-image:
 *   post:
 *     tags:
 *       - Upload
 *     summary: "Upload an image associated with a document to a specified S3 bucket"
 *     description: "Uploads an image file to a specified S3 bucket for a given document and returns the file URL."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "The ID of the client to which the document belongs."
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "The ID of the document to associate the image with."
 *     requestBody:
 *       description: "Image file to upload"
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: "The image file to upload."
 *     responses:
 *       200:
 *         description: "Successfully uploaded the image and returned the S3 URL."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 imageUrl:
 *                   type: string
 *                   example: "https://default-bucket.s3.region.amazonaws.com/uploads/image123.jpg"
 *       400:
 *         description: "Bad Request - Invalid parameters or file format."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Invalid clientId, docId, or file format."
 *       500:
 *         description: "Internal server error."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Failed to upload image to S3."
 */

// POST: Upload image to specified S3 bucket associated with a document
router.post('/:clientId/documents/:docId/upload-image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { clientId, docId } = req.params;
    const folderPath = `uploads/${docId}`

    // Validate clientId, docId, and file presence
    if (!clientId || !docId) {
      return res.status(400).json({ status: 'error', message: 'clientId and docId are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No image file provided.' });
    }
    const bucketName = 'knowledgekeeper-images'
    // Upload image to S3
    const imageUrl = await uploadImageToS3(req.file,bucketName, folderPath as string);

    res.json({
      status: 'success',
      imageUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Failed to upload image to S3' });
  }
});


/**
 * @swagger
 * /clients/{clientId}/bytes/closed:
 *   get:
 *     tags:
 *       - Bytes
 *     summary: "Get all bytes with a closed status and high resolved recommendation count"
 *     description: "Returns a list of all bytes that are marked as 'closed' and have a high resolved recommendation count for a specific document and client."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: "The ID of the client"
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: "Successfully retrieved all closed bytes with high resolved recommendation count."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: "ID of the byte"
 *                   byteInfo:
 *                     type: string
 *                     description: "Information about the byte"
 *                   noOfRecommendations:
 *                     type: integer
 *                     description: "Number of resolved recommendations"
 *                   status:
 *                     type: string
 *                     description: "Status of the byte (closed)"
 *                   isProcessedByRecommendation:
 *                     type: boolean
 *                     description: "Flag indicating if the byte is processed by recommendation"
 *                   docId:
 *                     type: integer
 *                     description: "The document ID associated with this byte"
 *       500:
 *         description: "Internal server error."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Server error"
 */

// Get all bytes with a status of 'closed' and high resolved recommendation counts
router.get('/:clientId/bytes/closed', verifyToken, async (req:any, res) => {
  try {
    let { clientId }: any = req.params;
    let userId = req.user.userId
    let userTeamspaceRepo = new UserTeamspaceRepository();
    const userTeampsaces = await userTeamspaceRepo.findTeamspacesForUser(userId);
    const teamspaceIds = userTeampsaces.map((userTeamspace)=> userTeamspace.teamspace.id)
    clientId = parseInt(clientId);
    
    const byteRepo = new ByteRepository();

    // Fetch bytes with a status of 'closed' and high resolved recommendation counts for the given documentId
    let bytes = await byteRepo.findAllClosedWithHighResolvedRecommendations(parseInt(clientId), teamspaceIds);

    if (!bytes || bytes.length === 0) {
      bytes = []
    }

    // If bytes are found, return them
    res.json({
      status: 'success',
      data: bytes,
    });
  } catch (error) {
    console.error('Error retrieving closed bytes:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve closed bytes. Please try again later.',
    });
  }
});

/**
 * @swagger
 * /clients/{clientId}/bytes/delete:
 *   post:
 *     tags:
 *       - Bytes
 *     summary: "Mark a byte (recommendation) as deleted"
 *     description: "This API marks an existing byte as deleted instead of actually deleting it. The byte will still exist in the system, but will be considered 'deleted'."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: "The ID of the client"
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               byteId:
 *                 type: integer
 *                 description: "The ID of the byte to be marked as deleted"
 *                 example: 456
 *     responses:
 *       200:
 *         description: "Byte marked as deleted successfully."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Change Request is deleted"
 *       400:
 *         description: "Bad request - Byte ID is missing or invalid"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Byte ID is required"
 *       404:
 *         description: "Byte not found"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Byte not found"
 *       500:
 *         description: "Internal server error"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Error marking byte as deleted"
 */

// Mark byte as deleted (isDeleted: true)
router.post('/:clientId/bytes/delete', verifyToken, async (req:any, res) => {
  const { byteId } = req.body;
  
  if (!byteId || isNaN(byteId)) {
    return res.status(400).json({ status: 'error', message: 'Valid Byte ID is required' });
  }

  try {
    const byteRepo = new ByteRepository();
    const userId = req.user.userId
    
    // Check if the byte exists before attempting to update
    const byteExists = await byteRepo.findByteById(byteId);
    
    if (!byteExists) {
      return res.status(404).json({ status: 'error', message: 'Byte not found' });
    }

    // Resolve all byte based recommendations
    await byteRepo.handleRecommendationsRejected(byteExists, userId)

    // Mark the byte as deleted (isDeleted: true)
    await byteRepo.updateByte(byteId, { isDeleted: true });

    res.json({
      status: 'success',
      message: 'Change Request is deleted',
    });
  } catch (error) {
    console.error('Error marking byte as deleted:', error);
    res.status(500).json({ status: 'error', message: 'Failed to mark change request as deleted' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/bytes/trash:
 *   get:
 *     tags:
 *       - Bytes
 *     summary: "List all deleted bytes"
 *     description: "This API lists all the bytes that have been marked as deleted (isDeleted: true)."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: "The ID of the client"
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: "List of deleted bytes retrieved successfully."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   byteId:
 *                     type: integer
 *                     description: "The ID of the deleted byte"
 *                     example: 456
 *                   recommendation:
 *                     type: string
 *                     description: "The content of the byte"
 *                     example: "This is a deleted recommendation"
 *                   deletedAt:
 *                     type: string
 *                     format: date-time
 *                     description: "The timestamp when the byte was marked as deleted"
 *                     example: "2024-10-14T10:00:00Z"
 *       500:
 *         description: "Internal server error"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Error retrieving deleted bytes"
 */

// List all deleted bytes
router.get('/:clientId/bytes/trash', verifyToken, async (req:any, res) => {
  try {
    const byteRepo = new ByteRepository();
    const userId = req.user.userId
    const userTeamspaceRepo = new UserTeamspaceRepository();

    const userTeamspaces = await userTeamspaceRepo.findTeamspacesForUser(userId)
    const teamspaceIds = userTeamspaces.map((userTeamspace)=> userTeamspace.teamspace.id)
    
    // Retrieve all bytes marked as deleted
    const deletedBytes = await byteRepo.findDeletedBytes(parseInt(req.params.clientId),teamspaceIds);
    
    res.json(deletedBytes);
  } catch (error) {
    console.error('Error retrieving deleted bytes:', error);
    res.status(500).json({ status: 'failed', message: 'Failed to retrieve deleted bytes' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/teamspaces/unique:
 *   post:
 *     tags:
 *       - Teamspaces
 *     summary: "Check if a teamspace name is unique within a client"
 *     description: "This API checks if a teamspace name is unique within a specified client."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: "The ID of the client"
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamspaceName:
 *                 type: string
 *                 description: "The name of the teamspace"
 *     responses:
 *       200:
 *         description: "Teamspace name uniqueness check result."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isUnique:
 *                   type: boolean
 *                   description: "Whether the teamspace name is unique within the client."
 */

router.post('/:clientId/teamspaces/unique', verifyToken, async (req, res) => {
  const { clientId } = req.params;
  const { teamspaceName } = req.body;

  if (!teamspaceName) {
    return res.status(400).json({ status: 'failed', message: 'Teamspace name is required' });
  }
  try {
    const teamspaceRepository = new TeamspaceRepository();
    const teamspaceExists = await teamspaceRepository.isUniqueTeamspaceNameByClient(
      parseInt(clientId),
      teamspaceName
    );

    const isUnique = !teamspaceExists;

    res.json({ status: 'success', isUnique });
  } catch (error) {
    console.error('Error checking teamspace name uniqueness:', error);
    res.status(500).json({ status: 'failed', message: 'Error checking teamspace name' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/folders/{folderId}/documents/unique:
 *   post:
 *     tags:
 *       - Documents
 *     summary: "Check if a document name is unique within a folder"
 *     description: "This API checks if a document name is unique within a specified folder."
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         description: "The ID of the folder"
 *         schema:
 *           type: integer
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: "The ID of the client"
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentName:
 *                 type: string
 *                 description: "The name of the document"
 *     responses:
 *       200:
 *         description: "Document name uniqueness check result."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isUnique:
 *                   type: boolean
 *                   description: "Whether the document name is unique within the folder."
 */

router.post('/:clientId/folders/:folderId/documents/unique', verifyToken, async (req, res) => {
  const { folderId } = req.params;
  const { documentName } = req.body;

  if (!documentName) {
    return res.status(400).json({ status: 'failed', message: 'Document name is required' });
  }
  try {
    const folder = await documentRepository.getFolderById(parseInt(folderId));
    if(!folder){
      return res.status(400).json({ status: 'failed', message: 'Folder Id is incorrect' });
    }
    const documentExists = await documentRepository.isUniqueDocumentNameByFolder(parseInt(
                folderId),
              documentName)

    const isUnique = !documentExists;

    res.json({ status:'success',isUnique });
  } catch (error) {
    console.error('Error checking document name uniqueness:', error);
    res.status(500).json({ status: 'failed', message: 'Error checking document name' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/teamspaces/{teamspaceId}/folders/unique:
 *   post:
 *     tags:
 *       - Folders
 *     summary: "Check if a folder name is unique within a teamspace"
 *     description: "This API checks if a folder name is unique within a specified teamspace."
 *     parameters:
 *       - in: path
 *         name: teamspaceId
 *         required: true
 *         description: "The ID of the teamspace"
 *         schema:
 *           type: integer
*       - in: path
 *         name: clientId
 *         required: true
 *         description: "The ID of the teamspace"
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               folderName:
 *                 type: string
 *                 description: "The name of the folder"
 *     responses:
 *       200:
 *         description: "Folder name uniqueness check result."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isUnique:
 *                   type: boolean
 *                   description: "Whether the folder name is unique within the teamspace."
 */

router.post('/:clientId/teamspaces/:teamspaceId/folders/unique', async (req, res) => {
  const { teamspaceId } = req.params;
  const { folderName } = req.body;

  if (!folderName) {
    return res.status(400).json({ status: 'error', message: 'Folder name is required' });
  }

  const folderRepository = AppDataSource.getRepository(Folder)

  try {
    const folderExists = await folderRepository.findOne({
      where: {
        teamspace: { id: parseInt(teamspaceId) },
        folderName: folderName
      }
    });

    const isUnique = !folderExists;

    res.json({ status:'success',isUnique });
  } catch (error) {
    console.error('Error checking folder name uniqueness:', error);
    res.status(500).json({ status: 'error', message: 'Error checking folder name' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/bytes/create:
 *   post:
 *     tags:
 *       - Bytes
 *     summary: "Create a byte (recommendation)"
 *     description: "This API allows users to create a new byte based on document interactions or suggestions."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: "The ID of the client"
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recommendation:
 *                 type: string
 *                 description: "Detailed description or data for the byte"
 *                 example: "Potential update to section 4.3 regarding compliance."
 *               docId:
 *                 type: integer
 *                 description: "The document for which the byte belong to (optional)"
 *                 example: 1
 *               userId:
 *                 type: integer
 *                 description: "The ID of the user creating the byte"
 *                 example: 2
 *     responses:
 *       200:
 *         description: "Byte created successfully."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Byte created successfully"
 *                 byte:
 *                   $ref: '#/definitions/ByteDetails'
 *       400:
 *         description: "Bad request - Missing required fields or invalid data"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Missing required fields"
 *       500:
 *         description: "Internal server error"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "failed"
 *                 message:
 *                   type: string
 *                   example: "Error creating byte"
 */

// Create a new byte (recommendation)
router.post('/:clientId/bytes/create', verifyToken, async (req:any, res) => {
  console.log(req.body)
  let { recommendation, email, source, channel } = req.body;
  let { clientId }: any = req.params;
  const userId = req.user.userId

  const userTeamspaceRepo = new UserTeamspaceRepository();

  const userTeamspaces = await userTeamspaceRepo.findOwnerTeamspacesForUser(userId);
  const teamspaceIds = userTeamspaces.map((userTeamspace)=> userTeamspace.teamspace.id)


  clientId = parseInt(clientId)


  if(!email){
    const userRepo = new UserRepository();
    const user = await userRepo.findUserById(userId)
    email = user?.email
  }
  
  // Validate the input fields
  if (!recommendation || !userId) {
    return res.status(400).json({ status: 'error', message: 'All fields (documentId, recommendation, userId) are required' });
  }

  if (isNaN(userId)) {
    return res.status(400).json({ status: 'error', message: 'userId must be valid integers' });
  }

  try {
    const byteRepo = new ByteRepository();

    // Create the new byte
    const newByte = await byteRepo.createByte(recommendation, userId,clientId,email, teamspaceIds, source, channel);

    res.json({
      status: 'success',
      message: 'Byte created successfully',
      byte: newByte,  // Include byte data in response
    });
  } catch (error) {
    console.error('Error creating byte:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create byte' });
  }
});

/**
 * @swagger
 * /clients/clientDetails:
 *   get:
 *     tags:
 *       - Clients
 *     summary: "Retrieve client details by client ID"
 *     description: "Fetches detailed information for a specific client based on their unique identifier."
 *     parameters:
 *       - in: query
 *         name: clientId
 *         required: true
 *         type: string
 *         description: "The ID of the client to retrieve, expected as a string."
 *     responses:
 *       200:
 *         description: "Client details retrieved successfully."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Client details fetched successfully"
 *                 client:
 *                   $ref: '#/definitions/ClientResponse'
 *       400:
 *         description: "Client ID is missing or invalid."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Client ID is required"
 *       500:
 *         description: "Internal server error."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Server error"
 */
router.get('/clientDetails', verifyToken, async (req:any, res:any) => {
  const clientId = Array.isArray(req.query.clientId) ? req.query.clientId[0] : req.query.clientId;
  const userId = parseInt(req.user?.userId); // Assuming `userId` is set in `verifyToken` middleware
  console.log(typeof userId);

  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'Client ID is required'
    });
  }
  try {
    const clientRepo = new ClientRepository();
    const client = await clientRepo.findClientById(parseInt(clientId, 10));
    if (!client) {
      return res.status(404).json({
        status: 'error',
        message: 'Client not found'
      });
    }

    // Fetch teamspaces the user has access to for this client
    const userTeamspaceRepo = new UserTeamspaceRepository();
    const teamspaces = await userTeamspaceRepo.findUserTeamspacesForClient(userId);
    client.teamspaces = teamspaces
    res.json({
      status: 'success',
      message: 'Client details and teamspaces fetched successfully',
      client: client,
      teamspaces: teamspaces
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/teamspaces/{teamspaceId}/users:
 *   get:
 *     tags:
 *       - Clients
 *     summary: "List all users in a specific teamspace for a client"
 *     description: "Fetches all users that have access to a specific teamspace for a given client based on entries in the user_teamspace table."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "The ID of the client associated with the teamspace."
 *       - in: path
 *         name: teamspaceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "The ID of the teamspace to list users for."
 *     responses:
 *       200:
 *         description: "Successfully retrieved users in the teamspace."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/definitions/User'
 *       400:
 *         description: "Missing or invalid clientId or teamspaceId."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "clientId and teamspaceId are required."
 *       500:
 *         description: "Internal server error."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Server error while retrieving users."
 */
router.get('/:clientId/teamspaces/:teamspaceId/users', verifyToken, async (req, res) => {
  const { clientId, teamspaceId } = req.params;

  if (!clientId || !teamspaceId) {
    return res.status(400).json({
      status: 'error',
      message: 'clientId and teamspaceId are required.',
    });
  }

  try {
    const userTeamspaceRepo = new UserTeamspaceRepository();

    // Fetch all users in the specified teamspace for the client
    const users = await userTeamspaceRepo.findUsersByTeamspaceId(
      parseInt(teamspaceId, 10)
    );

    res.json({
      status: 'success',
      users,
    });
  } catch (error) {
    console.error('Error retrieving users in teamspace:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while retrieving users.',
    });
  }
});

/**
 * @swagger
 * /clients/{clientId}/teamspaces/{teamspaceId}/users/{userId}:
 *   delete:
 *     tags:
 *       - Clients
 *     summary: "Remove a user's access to a specific teamspace for a client"
 *     description: "Removes a user's access to a specified teamspace for a given client by deleting the record in the user_teamspace table."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "The ID of the client associated with the teamspace."
 *       - in: path
 *         name: teamspaceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "The ID of the teamspace to remove the user's access from."
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "The ID of the user whose access to the teamspace will be removed."
 *     responses:
 *       200:
 *         description: "User access to the teamspace removed successfully."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "User access to the teamspace removed successfully."
 *       400:
 *         description: "Missing or invalid parameters."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "clientId, teamspaceId, and userId are required."
 *       404:
 *         description: "User-teamspace access not found."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "User-teamspace access not found."
 *       500:
 *         description: "Internal server error."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Server error while removing user access."
 */
router.delete('/:clientId/teamspaces/:teamspaceId/users/:userId', verifyToken, async (req, res) => {
  const { teamspaceId, userId } = req.params;

  if (!teamspaceId || !userId) {
    return res.status(400).json({
      status: 'error',
      message: 'teamspaceId, and userId are required.',
    });
  }

  try {
    const userTeamspaceRepo = new UserTeamspaceRepository();

    // Find the user-teamspace access record
    const accessRecord = await userTeamspaceRepo.removeUserTeamspaceAccessRecord(parseInt(teamspaceId), parseInt(userId));

    if(accessRecord && accessRecord.status == 'error'){
      return {
        status: 'failed',
        message: accessRecord.message
      }
    }
    res.json({
      status: 'success',
      message: 'User access to the teamspace removed successfully.',
    });
  } catch (error) {
    console.error('Error removing user-teamspace access:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error while removing user access.',
    });
  }
});

/**
 * @swagger
 * /clients/{clientId}/bytes/{byteId}/recommendations:
 *   get:
 *     tags:
 *       - Recommendations
 *     summary: "Fetch recommendations for a specific document"
 *     description: "Makes an external API call to retrieve recommendations based on the document ID."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         type: string
 *         description: "The ID of the client for which recommendations are being requested."
 *       - in: path
 *         name: byteId
 *         required: true
 *         description: "The ID of the byte for which recommendations is required"
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: "Recommendations retrieved successfully."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/definitions/Recommendation'
 *       400:
 *         description: "Document ID is missing or invalid."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Document ID is required"
 *       500:
 *         description: "Failed to retrieve recommendations or internal server error."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Server error"
 */
router.get('/:clientId/bytes/:byteId/recommendations', verifyToken, async (req:any, res) => {
  const byteId = parseInt(req.params.byteId);
  const clientId = parseInt(req.params.clientId);
  const userId = parseInt(req.user.userId);
  const userTeampsaceRepo = new UserTeamspaceRepository();
  const userTeamspaces = await userTeampsaceRepo.findTeamspacesForUser(userId);
  const teamspaceIds = await userTeamspaces.map((userTeamspace)=> userTeamspace.teamspace.id)


  try {
      const byteRepo = new ByteRepository();
      const byte =  await byteRepo.findByteById(byteId);
      if(byte){
        const recommendations = await byteRepo.getRecommendations(byte,teamspaceIds);
        res.json({
            status: 'success',
            data: recommendations
        });
      }else{
        res.status(400).json({
          status: 'failed',
          message: 'Byte is incorrect'
      });
      }
      
  } catch (error) {
      res.status(500).json({
          status: 'failed',
          message: 'Failed to retrieve recommendations'
      });
  }
});

/**
 * @swagger
 * /{clientId}/documents:
 *   post:
 *     summary: "Upload an HTML document to S3, associate it with a client and folder, and create a document entry in the database"
 *     tags:
 *       - Document Management
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: "The client ID associated with the document"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "The HTML file to upload"
 *               documentName:
 *                 type: string
 *                 description: "The document name associated with the document"
 *               folderId:
 *                 type: integer
 *                 description: "The folder ID associated with the document"
 *               folderName:
 *                 type: string
 *                 description: "The folder name associated with the document (only required if folderId is not provided)"
 *     responses:
 *       201:
 *         description: "Document created and uploaded successfully"
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
 *                   example: "Document created successfully"
 *                 document:
 *                   type: object
 *                   properties:
 *                     docId:
 *                       type: integer
 *                       example: 123
 *                     versionNumber:
 *                       type: number
 *                       example: 1.0
 *                     docUrl:
 *                       type: string
 *                       example: "https://bucket-name.s3.region.amazonaws.com/file-name"
 *                     clientId:
 *                       type: integer
 *                       example: 456
 *                     documentName:
 *                       type: string
 *                       example: "Sample Document"
 *                     folder:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 789
 *                         folderName:
 *                           type: string
 *                           example: "Sample Folder"
 *                     htmlContent:
 *                       type: string
 *                       example: "<html>Document content</html>"
 *       400:
 *         description: "Bad request - Missing file, clientId or folder information"
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
 *                   example: "No file uploaded or invalid folder information"
 *       500:
 *         description: "Internal server error"
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
 *                   example: "Server error"
 */
router.post('/:clientId/documents', upload.single('file'), async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const file = req?.file;
  let folderId = parseInt(req.body.folderId, 10);
  let folderName = req.body?.folderName;
  let documentName = req?.body?.documentName;

  if (!file && !documentName) {
    return res.status(400).json({ status: false, message: 'No file uploaded or no documentName provided'});
  }

  try {
    const documentData = { ...req.body, client: { id: clientId } };

    // Step 1: Check if the client exists
    const clientRepo = new ClientRepository();
    const clientFound = await clientRepo.findClientById(clientId);
    if (!clientFound || Object.values(clientFound) == null) {
      return res.status(400).json({ status: false, message: 'Client not found' });
    }
    let s3Url = '', htmlContent = '';
    if(file){
      const filePath = path.join(file.destination, file.filename);
      const fsPromise = fs.promises;
      const htmlContent = await fsPromise.readFile(filePath,'utf-8');  
      const clientName = clientFound.clientName;
      const s3Url = await uploadToS3(file, clientName);

      // Step 4: Update the document data with the S3 URL, folder, and file content
      documentData.docContentUrl = s3Url;
    }

    // Step 2: Handle folder by ID or Name
    const documentRepo = new DocumentRepository();
    let folder: any;
    if (folderId) {
      folder = await documentRepo.getFolderById(folderId);
      if (!folder) {
        return res.status(400).json({ status: false, message: 'Folder not found' });
      }
    } else if (folderName) {
      // If folder name is given, create or fetch the folder
      const folderReq = {
        folderName,
        isTrained: false,
        reTrainingRequired: false,
        totalNumberOfDocs: 0,
        client: clientId,
      };
      folder = await documentRepo.createFolder(folderReq);
    }

    documentData.versionNumber = 1.0;
    documentData.isTrained = false;
    documentData.reTrainingRequired = false;
    documentData.updatedAt = new Date();
    documentData.teamspace = folder.teamspace

    // Associate the folder if one exists
    if (folder) {
      documentData.folder = folder.id;
    }

    // Step 5: Create and save the document to the database
    const newDocument = await documentRepository.createDocument(documentData);

    // Step 6: Update the folder's document count if necessary
    if (folder) {
      folder = await documentRepo.updateFolder(folder.id, { totalNumberOfDocs: folder.totalNumberOfDocs + 1 });
    }

    // Step 7: Return the response including the S3 URL and document details
    return res.status(201).json({
      status: true,
      message: 'Document created successfully',
      document: {
        docId: newDocument.id,
        versionNumber: newDocument.versionNumber,
        docUrl: s3Url,
        clientId,
        documentName: newDocument.documentName,
        folder,  // Return folder information if available
        htmlContent: htmlContent,  // Assuming the document contains this field,
        teamspace: folder.teamspace
      }
    });
  } catch (error) {
    console.error('Error creating document:', error);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
});

/**
* @swagger
* /clients/{clientId}/documents/{documentId}:
*   get:
*     summary: Get a document by ID
*     tags: [Documents]
*     parameters:
*       - in: path
*         name: clientId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the client
*       - in: path
*         name: documentId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the document
*     responses:
*       200:
*         description: Document retrieved successfully
*       404:
*         description: Document not found
*/
router.get('/:clientId/documents/:documentId', async (req, res) => {
  const documentId = parseInt(req.params.documentId);

  try {
      const document = await documentRepository.findDocumentById(documentId);
      if (!document) {
          return res.status(404).json({ error: 'Document not found' });
      }
      res.status(200).json(document);
  } catch (error) {
      res.status(500).json({ error: 'Could not retrieve document' });
  }
});

/**
* @swagger
* /clients/{clientId}/documents/{documentId}:
*   put:
*     summary: Update a document by ID
*     tags: [Documents]
*     parameters:
*       - in: path
*         name: clientId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the client
*       - in: path
*         name: documentId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the document
*     requestBody:
*       description: Document data
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/Document'
*     responses:
*       200:
*         description: Document updated successfully
*       400:
*         description: Invalid data
*       404:
*         description: Document not found
*/
router.put('/:clientId/documents/:documentId', upload.single('file'), async (req, res) => {
  const documentId = parseInt(req.params.documentId);
  const documentData = req.body;

  const file = req?.file

  let s3Url = '', htmlContent = '';
  if(file){
    let document = await documentRepository.findDocumentById(documentId);
    if(!document){
      res.status(400).json({message:'Error validating the document', status:'failed'})
    }
    const clientFound = document?.client 
    const filePath = path.join(file.destination, file.filename);
    const fsPromise = fs.promises;
    const htmlContent = await fsPromise.readFile(filePath,'utf-8');  
    const clientName = clientFound?.clientName;
    if(clientName){
      s3Url = await uploadToS3(file, clientName);
    }

    // Step 4: Update the document data with the S3 URL, folder, and file content
    documentData.docContentUrl = s3Url;
  }

  try {
      const updatedDocument:any = await documentRepository.updateDocument(documentId, documentData);
      if (!updatedDocument) {
          return res.status(404).json({ error: 'Document not found' });
      }
      updatedDocument.htmlContent = htmlContent
      res.status(200).json(updatedDocument);
  } catch (error) {
      res.status(400).json({ error: 'Could not update document' });
  }
});

/**
* @swagger
* /clients/{clientId}/documents/{documentId}:
*   delete:
*     summary: Delete a document by ID
*     tags: [Documents]
*     parameters:
*       - in: path
*         name: clientId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the client
*       - in: path
*         name: documentId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the document
*     responses:
*       200:
*         description: Document deleted successfully
*       404:
*         description: Document not found
*/
router.delete('/:clientId/documents/:documentId', async (req, res) => {
  const documentId = parseInt(req.params.documentId);

  try {
      const document = await documentRepository.findDocumentById(documentId);
      if (!document) {
          return res.status(404).json({ error: 'Document not found' });
      }

      await documentRepository.deleteDocument(documentId);
      const deleteDataFromChunksRequest = {
          data_id : uuidv4(),
          teamspace_name: document?.teamspace?.teamspaceName,
          s3_bucket: 'knowledge-keeper-results',
          s3_document_path: document.s3SentencedDocumentPath,
          document_ids: [`${document?.id}`]
      }
      const response = await axios.post(`${process.env.ML_ENDPOINT}/v2/delete_data_from_chunks`, deleteDataFromChunksRequest, {
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'Bearer a681787caab4a0798df5f33898416157dbfc50a65f49e3447d33fc7981920499' // Replace with your API token
        }
      });
      console.log(response.data)
      res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.log(error)
      res.status(500).json({ error: 'Could not delete document' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/folders:
 *   post:
 *     summary: Create a new folder for a client
 *     tags: [Folders]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *     requestBody:
 *       description: Folder data
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               folderName:
 *                 type: string
 *                 description: The name of the folder
 *                 example: "New Project Folder"
 *               teamspaceId:
 *                 type: string
 *                 description: The ID of the teamspace
 *                 example: "TeamspaceId for the folder"
 *     responses:
 *       201:
 *         description: Folder created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Folder'
 *       400:
 *         description: Invalid data
 */
router.post('/:clientId/folders', async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const { folderName, teamspaceId } = req.body;

  if (!folderName) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  if(!teamspaceId){
    return res.status(400).json({ status:'failed', error: 'Teamspace Id is required' });
  }

  const teamspaceRepo = new TeamspaceRepository();
  const teamspace = await teamspaceRepo.getTeamspaceById(teamspaceId)

  if(!teamspace){
    return res.status(400).json({ status:'failed', error: 'Teamspace Id is not found' });
  }

  try {
    const folderData = {
      folderName,
      client: { id: clientId }, // Link to client
      isTrained: false,
      reTrainingRequired: false,
      totalNumberOfDocs: 0, // Initialize with 0 documents,
      teamspace
    };
    const newFolder = await documentRepository.createFolder(folderData);
    res.status(201).json(newFolder);
  } catch (error) {
    res.status(400).json({ error: 'Could not create folder' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/folders:
 *   get:
 *     summary: Get all folders for a specific client
 *     tags: [Folders]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *     requestBody:
 *       description: Teamspace Id
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamspaceId:
 *                 type: string
 *                 description: The name of the teamspace
 *                 example: "New Project Teamspace"
 *     responses:
 *       200:
 *         description: Successfully retrieved all folders for the client
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Folder'
 *       404:
 *         description: No folders found for the client
 *       400:
 *         description: Invalid client ID
 */
router.get('/:clientId/folders', async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const teamspaceId = parseInt(req.body.teamspaceId);

  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  try {
    // Fetch all folders for the specific client
    const folders = await documentRepository.findFoldersByClientId(clientId, teamspaceId);

    if (folders.length === 0) {
      return res.status(404).json({ message: 'No folders found for this client' });
    }

    res.status(200).json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching folders' });
  }
});

/**
* @swagger
* /clients/{clientId}/folders/{folderId}:
*   get:
*     summary: Get a folder by ID
*     tags: [Folders]
*     parameters:
*       - in: path
*         name: clientId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the client
*       - in: path
*         name: folderId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the folder
*     requestBody:
*       description: Teamspace Id
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               teamspaceId:
*                 type: string
*                 description: The name of the teamspace
*                 example: "New Project Teamspace"
*     responses:
*       200:
*         description: Folder retrieved successfully
*       404:
*         description: Folder not found
*/
router.get('/:clientId/folders/:folderId', async (req, res) => {
  const folderId = parseInt(req.params.folderId);
  const teamspaceId = parseInt(req.params.folderId);

  try {
      const folder = await documentRepository.getFolderById(folderId,teamspaceId);
      if (!folder) {
          return res.status(404).json({ error: 'Folder not found' });
      }
      res.status(200).json(folder);
  } catch (error) {
      res.status(500).json({ error: 'Could not retrieve folder' });
  }
});

/**
* @swagger
* /clients/{clientId}/folders/{folderId}:
*   put:
*     summary: Update a folder by ID
*     tags: [Folders]
*     parameters:
*       - in: path
*         name: clientId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the client
*       - in: path
*         name: folderId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the folder
*     requestBody:
*       description: Folder data
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/Folder'
*     responses:
*       200:
*         description: Folder updated successfully
*       400:
*         description: Invalid data
*       404:
*         description: Folder not found
*/
router.put('/:clientId/folders/:folderId', async (req, res) => {
  const folderId = parseInt(req.params.folderId);
  const folderData = req.body;

  try {
      const updatedFolder = await documentRepository.updateFolder(folderId, folderData);
      if (!updatedFolder) {
          return res.status(404).json({ error: 'Folder not found' });
      }
      res.status(200).json(updatedFolder);
  } catch (error) {
      res.status(400).json({ error: 'Could not update folder' });
  }
});

/**
* @swagger
* /clients/{clientId}/folders/{folderId}:
*   delete:
*     summary: Delete a folder by ID
*     tags: [Folders]
*     parameters:
*       - in: path
*         name: clientId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the client
*       - in: path
*         name: folderId
*         schema:
*           type: integer
*         required: true
*         description: The ID of the folder
*     responses:
*       200:
*         description: Folder deleted successfully
*       404:
*         description: Folder not found
*/
router.delete('/:clientId/folders/:folderId', async (req, res) => {
  const folderId = parseInt(req.params.folderId);

  try {
      const folder = await documentRepository.getFolderById(folderId);
      if (!folder) {
          return res.status(404).json({ error: 'Folder not found' });
      }

      await documentRepository.deleteFolder(folderId);
      res.status(200).json({ message: 'Folder deleted successfully' });
  } catch (error) {
      res.status(500).json({ error: 'Could not delete folder' });
  }
});


/**
 * @swagger
 * /clients/{clientId}/documents/{docId}/recommendations:
 *   get:
 *     summary: Get all HTML documents and recommendations by clientId and docId
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: path
 *         name: docId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the document to retrieve
 *     responses:
 *       200:
 *         description: List of documents with recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 document:
 *                   $ref: '#/components/schemas/Document'
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recommendation'
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.get('/:clientId/documents/:docId/recommendations', verifyToken, async (req: any, res: Response) => {
  const clientId = parseInt(req.params.clientId);
  const docId = parseInt(req.params.docId);

  try {
      const byteRepo = new ByteRepository();
      const document =  await documentRepository.findDocumentById(docId);
      if(document){
        const recommendations = await byteRepo.getRecommendationsBasedOnDocId(docId);
        res.json({
            status: 'success',
            data: recommendations
        });
      }else{
        res.status(400).json({
          status: 'failed',
          message: 'Document is incorrect or invalid'
      });
      }
      
  } catch (error) {
      res.status(500).json({
          status: 'failed',
          message: 'Failed to retrieve recommendations'
      });
  }
});


/**
 * @swagger
 * /clients/{clientId}/documents/{docId}/html:
 *   get:
 *     summary: Get HTML document from S3 by clientId and docId
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client to retrieve
 *       - in: path
 *         name: docId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the document to retrieve
 *     responses:
 *       200:
 *         description: HTML document fetched successfully
 *       404:
 *         description: Document not found
 *       500:
 *         description: Server error
 */
router.get('/:clientId/documents/:docId/html', verifyToken, async (req: Request, res: Response) => {
  const clientId = parseInt(req.params.clientId);
  const docId = parseInt(req.params.docId);

  if (!clientId || !docId) {
      return res.status(400).json({ message: 'Invalid client ID or document ID' });
  }

  try {
      // Step 1: Fetch the document details from the database based on docId and clientId
      const document = await documentRepository.findDocumentByClientAndId(clientId, docId);
      if (!document) {
          return res.status(404).json({ message: 'Document not found' });
      }

      const { docContentUrl } = document;

      // Step 2: Fetch the HTML content from the docContentUrl
      const response = await axios.get(docContentUrl, { responseType: 'text' });

      // Step 3: Return the HTML content as the response
      response.data = response?.data?.toString()
      return res.status(200).send({
        html:response.data
      });

  } catch (error: any) {
      console.error('Error fetching HTML document:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @swagger
 * /clients/{clientId}/bytes/{id}:
 *   get:
 *     summary: Get a Byte by ID for a specific client and document
 *     tags: [Bytes]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the byte to retrieve
 *     responses:
 *       200:
 *         description: The requested Byte
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 byteInfo:
 *                   type: string
 *                 requestedBy:
 *                   $ref: '#/components/schemas/UserDetails'
 *                 noOfRecommendations:
 *                   type: integer
 *                 isProcessedByRecommendation:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 docId:
 *                   $ref: '#/components/schemas/Document'
 *       404:
 *         description: Byte not found
 *       400:
 *         description: Invalid Byte ID
 *       500:
 *         description: Server error
 */
router.get('/:clientId/bytes/:byteId', verifyToken, async (req: any, res: Response) => {
  let { clientId, byteId }: any = req.params;
  let userId = req.user.userId
  clientId = parseInt(byteId)
  byteId = parseInt(byteId)


  // Validate clientId, documentId, and byteId
  if (isNaN(parseInt(clientId)) ||  isNaN(parseInt(byteId))) {
    return res.status(400).json({ message: 'Invalid clientId, documentId, or byteId' });
  }

  try {
    const byteRepository = new ByteRepository();
    const userTeamspaceRepo = new UserTeamspaceRepository();

    const userTeamspaces = await userTeamspaceRepo.findTeamspacesForUser(userId);
    const teamspaceIds  = userTeamspaces.map((userTeamspace)=> userTeamspace.teamspace.id)

    // Fetch the byte by id, ensuring it belongs to the correct client and document
    const byte = await byteRepository.findByteByClientAndDocument(byteId,teamspaceIds);

    if (!byte) {
      return res.status(404).json({ message: 'Byte not found' });
    }

    // Return the byte information as the response
    return res.status(200).json(byte);
  } catch (error: any) {
    console.error('Error fetching Byte:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});
  

// Create a new teamspace for a client
/**
 * @swagger
 * /clients/{clientId}/teamspaces:
 *   post:
 *     summary: Create a new teamspace for a client
 *     tags: [Teamspaces]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *     requestBody:
 *       description: Teamspace data
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamspaceName:
 *                 type: string
 *                 description: The name of the teamspace
 *                 example: "Development Team"
 *     responses:
 *       201:
 *         description: Teamspace created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Teamspace'
 *       400:
 *         description: Invalid data
 */
router.post('/:clientId/teamspaces', verifyToken, async (req:any, res) => {
  const clientId = parseInt(req.params.clientId);
  const { teamspaceName } = req.body;
  const userId = req.user.userId
  const userTeamspaceRepo = new UserTeamspaceRepository();

  const teamspaceRepository = new TeamspaceRepository();
  const clientRepository = new ClientRepository();

  if (!teamspaceName) {
    return res.status(400).json({ error: 'Teamspace name is required' });
  }

  const client = await clientRepository.findClientById(clientId); // Load the full client entity
  try {
    if(!client){
      res.status(400).json({ error: 'Invalid client' });
    }else{
      const teamspaceData = {
        teamspaceName,
        client,
        isTrained: false,
        reTrainingRequired: false,
        totalNumberOfDocs: 0
      };
  
      const newTeamspace = await teamspaceRepository.createTeamspace(teamspaceData);
      const userTeamspace = await userTeamspaceRepo.saveUserTeamspace(userId, newTeamspace?.id, 'MEMBER', 'OWNER')

      res.status(200).json(newTeamspace);
    }
  } catch (error) {
    res.status(400).json({ error: 'Could not create teamspace' });
  }
});

// Get all teamspaces for a specific client
/**
 * @swagger
 * /clients/{clientId}/teamspaces:
 *   get:
 *     summary: Get all teamspaces for a specific client
 *     tags: [Teamspaces]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *     responses:
 *       200:
 *         description: Successfully retrieved all teamspaces for the client
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Teamspace'
 *       404:
 *         description: No teamspaces found for the client
 *       400:
 *         description: Invalid client ID
 */
router.get('/:clientId/teamspaces', verifyToken, async (req:any, res) => {
  const clientId = parseInt(req.params.clientId);
  const userId = req.user.userId;
  const userTeamspaceRepo = new UserTeamspaceRepository();
  const userTeamspaces = await userTeamspaceRepo.findTeamspacesForUser(userId);
  const teamspaceIds = userTeamspaces.map((userTeamspace)=> userTeamspace.teamspace.id)
  
  const teamspaceRepository = new TeamspaceRepository();

  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  try {
    
    // Fetch all teamspaces for the specific client
    const teamspaces = await teamspaceRepository.findTeamspacesByClientId(clientId);

    if (teamspaces.length === 0) {
      return res.status(404).json({ message: 'No teamspaces found for this client' });
    }

    res.status(200).json(teamspaces);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching teamspaces' });
  }
});

// Get a teamspace by ID
/**
 * @swagger
 * /clients/{clientId}/teamspaces/{teamspaceId}:
 *   get:
 *     summary: Get a teamspace by ID
 *     tags: [Teamspaces]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: path
 *         name: teamspaceId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the teamspace
 *     responses:
 *       200:
 *         description: Teamspace retrieved successfully
 *       404:
 *         description: Teamspace not found
 */
router.get('/:clientId/teamspaces/:teamspaceId', async (req, res) => {
  const teamspaceId = parseInt(req.params.teamspaceId);
  const teamspaceRepository = new TeamspaceRepository();
  try {
    const teamspace = await teamspaceRepository.getTeamspaceById(teamspaceId);
    if (!teamspace) {
      return res.status(404).json({ error: 'Teamspace not found' });
    }
    res.status(200).json(teamspace);
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Could not retrieve teamspace' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/teamspaces/{teamspaceId}:
 *   put:
 *     summary: Update a teamspace by ID
 *     tags: [Teamspaces]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: path
 *         name: teamspaceId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the teamspace
 *     requestBody:
 *       description: Teamspace data
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Teamspace'
 *     responses:
 *       200:
 *         description: Teamspace updated successfully
 *       400:
 *         description: Invalid data
 *       404:
 *         description: Teamspace not found
 */
router.put('/:clientId/teamspaces/:teamspaceId', async (req, res) => {
  const teamspaceId = parseInt(req.params.teamspaceId);
  const teamspaceData = req.body;
  const teamspaceRepository = new TeamspaceRepository();

  try {
    const updatedTeamspace = await teamspaceRepository.updateTeamspace(teamspaceId, teamspaceData);
    if (!updatedTeamspace) {
      return res.status(404).json({ error: 'Teamspace not found' });
    }
    res.status(200).json(updatedTeamspace);
  } catch (error) {
    console.log(error)
    res.status(400).json({ error: 'Could not update teamspace' });
  }
});

// Delete a teamspace by ID
/**
 * @swagger
 * /clients/{clientId}/teamspaces/{teamspaceId}:
 *   delete:
 *     summary: Delete a teamspace by ID
 *     tags: [Teamspaces]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: path
 *         name: teamspaceId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the teamspace
 *     responses:
 *       200:
 *         description: Teamspace deleted successfully
 *       404:
 *         description: Teamspace not found
 */
router.delete('/:clientId/teamspaces/:teamspaceId', async (req, res) => {
  const teamspaceId = parseInt(req.params.teamspaceId);

  try {
    const teamspaceRepository = new TeamspaceRepository();
    const teamspace = await teamspaceRepository.getTeamspaceById(teamspaceId);

    if (!teamspace) {
      return res.status(404).json({ error: 'Teamspace not found' });
    }

    await teamspaceRepository.deleteTeamspace(teamspaceId);
    res.status(200).json({ message: 'Teamspace deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete teamspace' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/byte/{byteId}/is-pending:
 *   get:
 *     summary: Check if there is any pending task with the given byteId
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: byteId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the byte
 *     responses:
 *       200:
 *         description: Returns true if there is a pending task, otherwise false
 *       404:
 *         description: No tasks found with the given byteId
 *       500:
 *         description: Internal server error
 */
router.get('/:clientId/byte/:byteId/is-pending',verifyToken, async (req, res) => {
  const byteId = parseInt(req.params.byteId);

  try {
    const taskRepository = new TaskRepository();
    
    // Check for any pending task with the given byteId
    const task = await taskRepository.isPendingTaskForByte(byteId);

    if (!task) {
      return res.status(200).json({ status:'success',pending: false });
    }

    return res.status(200).json({ status:'success',pending: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status:'failed',error: 'Could not check for pending tasks' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/byte/{byteId}/is-pending-user-recommendation:
 *   get:
 *     summary: Get the count of pending recommendations for the given byteId
 *     tags: [Bytes]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: path
 *         name: byteId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the byte
 *     responses:
 *       200:
 *         description: Returns the count of pending recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 pendingCount:
 *                   type: integer
 *       404:
 *         description: Byte or recommendations not found
 *       500:
 *         description: Internal server error
 */
router.get('/:clientId/byte/:byteId/is-pending-user-recommendation', verifyToken, async (req, res) => {
  const byteId = parseInt(req.params.byteId);

  try {
    const taskRepository = new TaskRepository();

    // Get the count of pending recommendations for the specified byteId
    const pendingStatus = await taskRepository.isPendingUserRecommendationForByte(byteId);

    return res.status(200).json({ status: 'success', pendingStatus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'failed', error: 'Could not retrieve pending recommendations count' });
  }
});


/**
 * @swagger
 * /clients/{clientId}/byte/{byteId}/feedback:
 *   post:
 *     summary: Add feedback to a byte
 *     tags: 
 *       - Bytes
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: path
 *         name: byteId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the byte
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               feedback:
 *                 type: string
 *                 example: "AI is wrong"
 *     responses:
 *       200:
 *         description: Feedback added successfully
 *       404:
 *         description: Byte not found
 *       500:
 *         description: Could not add feedback
 */
router.post('/:clientId/byte/:byteId/feedback', async (req, res) => {
  const { byteId } = req.params;

  const { feedback } = req.body;

  try {
    const byteRepository = new ByteRepository();

    // Find the byte by ID
    const byte = await byteRepository.findByteById(parseInt(byteId))

    if (!byte) {
      return res.status(404).json({ status:'failed',error: 'Byte not found' });
    }

    // Update the userFeedback field
    byte.userFeedback = feedback;
    await byteRepository.saveByte(byte);

    return res.status(200).json({ status:'success',message: 'Feedback added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status:'failed',error: 'Could not add feedback' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/teamspaces/{teamspaceId}/invite:
 *   post:
 *     summary: Invite a user to a teamspace
 *     tags: [Teamspaces]
 *     parameters:
 *       - in: path
 *         name: teamspaceId
*       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the teamspace
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               email:
 *                 type: string
 *                 example: "dummy@gmail.com"
 *     responses:
 *       200:
 *         description: User invited successfully
 *       404:
 *         description: Teamspace or User not found
 *       500:
 *         description: Could not invite user
 */
router.post('/:clientId/teamspaces/:teamspaceId/invite', async (req, res) => {
  const { email } = req.body;
  const teamspaceId = parseInt(req.params.teamspaceId);

  try {
      const userRepository = new UserRepository(); // Assuming you have a user repository
      const teamspaceRepository = new TeamspaceRepository();
      const userTeamspaceRepository = new UserTeamspaceRepository(); // Assuming a repository for the relationship

      // Find the user and teamspace
      let user:any = ''
      if(email){
        for(const eachEmail of email){
          user = await userRepository.findUserByEmail(eachEmail)
          const teamspace = await teamspaceRepository.getTeamspaceById(teamspaceId)
          console.log(user)
          console.log(teamspace)
          if (!user || !teamspace) {
              return res.status(404).json({ error: 'User or Teamspace not found' });
          }
          const userTeamspace = new UserTeamspace();
          // Check if the user is already part of the teamspace
          const existingUserTeamspace = await userTeamspaceRepository.checkUserAccessToTeamspace(user.id,teamspaceId);
    
          if (existingUserTeamspace) {
              return res.status(400).json({ error: 'User is already invited to this teamspace' });
          }
    
          await userTeamspaceRepository.saveUserTeamspace(user.id, teamspace.id);
        }
      }
      
      

      return res.status(200).json({ message: 'User invited successfully' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Could not invite user' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/teamspace/channels:
 *   get:
 *     summary: Get teamspace channels by user email
 *     tags: [Slack]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         required: true
 *         description: The email of the user to fetch associated teamspace channels
 *     responses:
 *       200:
 *         description: Teamspace channels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   teamspaceId:
 *                     type: string
 *                     example: "550e8400-e29b-41d4-a716-446655440000"
 *                   channels:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["backend", "design"]
 *       400:
 *         description: Invalid or missing email
 *       404:
 *         description: No channels found for the given email
 *       500:
 *         description: Could not retrieve teamspace-channels
 */
router.get('/:clientId/teamspace/channels', async (req, res) => {
  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing email parameter' });
  }
  console.log(email)

  try {
    const teamspaceChannelsRepository = new TeamspaceChannelsRepository(); // Assuming repository class exists
    const channels = await teamspaceChannelsRepository.getTeamspaceChannelsByUser(email.toLowerCase());
    console.log(channels)

    return res.status(200).json(channels);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not retrieve teamspace-channels' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/slack:
 *   get:
 *     summary: Get slack Token by Id
 *     tags: [Slack]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *       - in: query
 *         name: slackId
 *         schema:
 *           type: string
 *         required: true
 *         description: The slackId to retrieve token
 *     responses:
 *       200:
 *         description: Slack Token retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slackId:
 *                   type: string
 *                   example: "T3DSDF3FD"
 *                 accessToken:
 *                   type: string
 *                   example: "xof-adfasdfsddf-dafdsfdasf-sadfasdfasx"
 *       400:
 *         description: Invalid or missing email
 *       404:
 *         description: No channels found for the given email
 *       500:
 *         description: Could not retrieve teamspace-channels
 */
router.get('/:clientId/slack', async (req, res) => {
  const { slackId } = req.query;

  if (!slackId || typeof slackId !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing slackId parameter' });
  }
  console.log(slackId)

  try {
    const slackRepository = new SlackRepository(); // Assuming repository class exists
    const slackDetails = await slackRepository.getSlackTokensById(slackId);
    console.log(slackDetails)

    return res.status(200).json(slackDetails);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not retrieve teamspace-channels' });
  }
});

/**
 * @swagger
 * /clients/{clientId}/slack/assign-user-to-channel-and-bot:
 *   post:
 *     summary: Save a Slack channel for a teamspace
 *     tags: [Slack]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               teamspaceName:
 *                 type: string
 *                 example: "WakeCap"
 *               email:
 *                 type: string
 *                 example: "rahul.shetty@wakecap.com"
 *               channel:
 *                 type: string
 *                 example: "backend"
 *     responses:
 *       200:
 *         description: Channel saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Channel saved successfully"
 *       400:
 *         description: Invalid or missing parameters
 *       404:
 *         description: Teamspace not found
 *       500:
 *         description: Could not save the channel
 */
router.post('/:clientId/slack/assign-user-to-channel-and-bot',authenticate, async (req, res) => {
  const { clientId } = req.params;
  const { teamspaceName, email, channel } = req.body;

  // Validate input
  if (!teamspaceName || !email || !channel || typeof teamspaceName !== 'string' || typeof email !== 'string' || typeof channel !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing parameters' });
  }

  try {
    const teamspaceChannelsRepository = new TeamspaceChannelsRepository(); // Assuming repository class exists
    const teamspaceRepository = new TeamspaceRepository(); // Assuming repository for teamspace exists
    // Find teamspace by name
    const teamspace = await teamspaceRepository.findByTeamspaceName(teamspaceName);

    if (!teamspace) {
      // Create Teamspace using that name if not already exists and add to user_teamspace
      const clientRepo = new ClientRepository();
      const userTeampsaceRepo = new UserTeamspaceRepository();
      const userRepo = new UserRepository();
      const user = await userRepo.findUserByEmail(email)
      const client = await clientRepo.findClientById(5);
      if(client){
        const teamspaceData = {
          teamspaceName,
          client,
          isTrained: false,
          reTrainingRequired: false,
          totalNumberOfDocs: 0
        };
        const teamspace = await teamspaceRepository.createTeamspace(teamspaceData)
        if(user){
          await userTeampsaceRepo.saveUserTeamspace(user.id,teamspace?.id,'MEMBER','OWNER')
        }  
      }

    }

    // Save the channel
    await teamspaceChannelsRepository.saveTeamspaceChannelUsingTeamspaceName(teamspaceName, email, channel);

    return res.status(200).json({ message: 'Channel saved successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not save the channel' });
  }
});

export default router;