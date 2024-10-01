import { Request, Response, Router } from 'express';
import { AppDataSource } from '../db/data_source';
import { Document } from '../entities/document'; // Your document entity
import { Client } from '../entities/client';
import multer from 'multer';
import { extractHeadersFromHtml, sendMessageToRabbitMQ, uploadToS3 } from '../modules/s3Module';
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
 *               clientName:
 *                 type: string
 *                 description: "The client name associated with the document"
 *               folderId:
 *                 type: integer
 *                 description: "The folderId associated with the document"
 *               folderName:
 *                 type: string
 *                 description: "The folder name associated with the document"
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
    let folderId = req.body?.folderId;
    let folderName = req.body?.folderName;

    console.log('folderName',folderName)
    let client: Partial<Client> = {};

    if(!clientName && !clientId){
      return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.BAD_CLIENT_REQUEST))
    }
    const documentRepo = new DocumentRepository();

    // Step 1: Create and save document to database
    const clientRepo = new ClientRepository();
    if(clientId){
      const clientFound = await clientRepo.findClientById(clientId)
      if(!clientFound || Object.values(clientFound) == null){
        return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.CLIENT_NOT_FOUND))
      }
      client = clientFound
    }else{
      if(clientName){
        const clientFound = await clientRepo.findClientByName(clientName)
        if(clientFound){
          client = clientFound
        }else{
          // Create client using clientName
          client = await clientRepo.createClient(clientName)
        }
      }
    }
         
    clientId = client?.id
    clientName = client.clientName

    let folder:any;
    if(folderId){
      folder = await documentRepo.getFolderById(folderId)
      if(!folder){
        return res.json({
          status: false,
          message: 'No folder found with the id'
        });
      }
    }else if(folderName){
      const folderReq = {
        folderName,
        isTrained:false,
        reTrainingRequired: false,
        totalNumberOfDocs: 0,
        client: clientId
      }
      folder = await documentRepo.createFolder(folderReq)
      console.log(folder)
    }

    // Step 2: Upload the file to S3 
    const s3Url = await uploadToS3(file, clientName);

    let document = await documentRepo.findDocumentByDocUrl(s3Url);

    console.log(s3Url)
    folderId = folder?.id ? folder.id : null
    let createdocumentRequest = {}
    if(!document || Object.values(document) == null){
      if(folder){
        createdocumentRequest = {
          docContentUrl: s3Url,
          versionNumber: 1.0,
          isTrained: false,
          reTrainingRequired: false,
          updatedAt: new Date(),
          client: clientId,
          folder: folderId
        }
      }else{
        createdocumentRequest = {
          docContentUrl: s3Url,
          versionNumber: 1.0,
          isTrained: false,
          reTrainingRequired: false,
          updatedAt: new Date(),
          client: clientId,
        }
      }
      document = await documentRepo.createDocument(createdocumentRequest);
    }

    if(folder){
      console.log(folder)
      folder = await documentRepo.updateFolder(folder?.id, {totalNumberOfDocs: folder?.totalNumberOfDocs + 1});
    }
    
    // Step 3: Place a request in RabbitMQ
    await sendMessageToRabbitMQ({
      docId: document.id,
      versionNumber: document.versionNumber,
      clientId,
      isTrained: false
    });

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
  let { userId, docId, byteId,byteInfo, changeRequestType, changes, changeSummary, isTrained, clientId } = req.body;

  if (!userId || !docId || !changeRequestType || !changes || !changeSummary || isTrained === undefined || clientId) {
    return res.status(400).json({
      status: 'failed',
      message: 'Missing required fields',
    });
  }
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

  // If no byteId - create one

  if(!byteId){
    const byteRepo = new ByteRepository();
    byteDetails = await byteRepo.createByte(byteInfo, userDetails,clientId)
  }else{
    const byteRepo = new ByteRepository();
    byteDetails = await byteRepo.findByteById(byteId)
  }

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
  );

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
router.get('/:clientId/bytes/open', verifyToken, async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const byteRepo = new ByteRepository();
      const bytes = await byteRepo.findAllOpenWithHighRecommendations(parseInt(clientId));
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
router.get('/:clientId/bytes/closed', verifyToken, async (req, res) => {
  try {
    let { clientId }: any = req.params;

    clientId = parseInt(clientId)
    
    const byteRepo = new ByteRepository();

    // Fetch bytes with a status of 'closed' and high resolved recommendation counts for the given documentId
    let bytes = await byteRepo.findAllClosedWithHighResolvedRecommendations(parseInt(clientId));

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
 *     summary: "Delete a byte (recommendation)"
 *     description: "This API allows users to delete an existing byte. Note that this action cannot be undone."
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         description: "The ID of the client"
 *         schema:
 *           type: integer
 *       - in: path
 *         name: documentId
 *         required: true
 *         description: "The ID of the document"
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
 *                 description: "The ID of the byte to be deleted"
 *                 example: 456
 *     responses:
 *       200:
 *         description: "Byte deleted successfully."
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
 *                   example: "Byte deleted successfully"
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
 *                   example: "Error deleting byte"
 */

// Delete a byte (recommendation)
router.post('/clients/:clientId/bytes/delete', verifyToken, async (req, res) => {
  const { byteId } = req.body;
  
  if (!byteId || isNaN(byteId)) {
    return res.status(400).json({ status: 'error', message: 'Valid Byte ID is required' });
  }

  try {
    const byteRepo = new ByteRepository();
    
    // Check if the byte exists before attempting to delete
    const byteExists = await byteRepo.findByteById(byteId);
    
    if (!byteExists) {
      return res.status(404).json({ status: 'error', message: 'Byte not found' });
    }

    // Delete the byte
    await byteRepo.deleteByte(byteId);

    res.json({
      status: 'success',
      message: 'Byte deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting byte:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete byte' });
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
router.post('/:clientId/bytes/create', verifyToken, async (req, res) => {
  const { recommendation, userId } = req.body;
  let { clientId }: any = req.params;

  clientId = parseInt(clientId)

  
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
    const newByte = await byteRepo.createByte(recommendation, userId,clientId);

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

  router.get('/clientDetails', verifyToken, async (req, res) => {
    const clientId = Array.isArray(req.query.clientId) ? req.query.clientId[0] : req.query.clientId;
    if (!clientId || typeof clientId !== 'string') {
        return res.status(400).json({
            status: 'error',
            message: 'Client ID is required'
        });
    }
    try {
        const clientRepo = new ClientRepository();
        const client = await clientRepo.findClientById(parseInt(clientId,10));
        if (!client) {
            return res.status(404).json({
                status: 'error',
                message: 'Client not found'
            });
        }
        res.json({
            status: 'success',
            message: 'Client details fetched successfully',
            client: client
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
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
 *       - in: query
 *         name: docId
 *         required: true
 *         type: string
 *         description: "The ID of the document for which recommendations are being requested."
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
router.get('/:clientId/bytes/:byteId/recommendations', verifyToken, async (req, res) => {
  const byteId = parseInt(req.params.documentId);
  const clientId = parseInt(req.params.clientId)


  try {
      const byteRepo = new ByteRepository();
      const byte =  await byteRepo.findByteById(byteId);
      const docId = byte?.docId?.id
      if(!docId){
        return res.status(404).json({ 
          status:'failed',
          errorCode: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found'
        });
      }
      if(byte){
        const recommendations = await byteRepo.getRecommendations(docId,byte?.byteInfo);
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
 * /clients/{clientId}/documents:
 *   post:
 *     summary: Create a new document for a client
 *     tags: [Documents]
 *     parameters:
 *       - in: path
 *         name: clientId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the client
 *     requestBody:
 *       description: Document data
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Document'
 *     responses:
 *       201:
 *         description: Document created successfully
 *       400:
 *         description: Invalid data
 */
router.post('/:clientId/documents', async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const documentData = { ...req.body, client: { id: clientId } };

  try {
      const newDocument = await documentRepository.createDocument(documentData);
      res.status(201).json(newDocument);
  } catch (error) {
      res.status(400).json({ error: 'Could not create document' });
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
router.put('/:clientId/documents/:documentId', async (req, res) => {
  const documentId = parseInt(req.params.documentId);
  const documentData = req.body;

  try {
      const updatedDocument = await documentRepository.updateDocument(documentId, documentData);
      if (!updatedDocument) {
          return res.status(404).json({ error: 'Document not found' });
      }
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
      res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
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
  const { folderName } = req.body;

  if (!folderName) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  try {
    const folderData = {
      folderName,
      client: { id: clientId }, // Link to client
      isTrained: false,
      reTrainingRequired: false,
      totalNumberOfDocs: 0, // Initialize with 0 documents
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

  if (isNaN(clientId)) {
    return res.status(400).json({ error: 'Invalid client ID' });
  }

  try {
    // Fetch all folders for the specific client
    const folders = await documentRepository.findFoldersByClientId(clientId);

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
*     responses:
*       200:
*         description: Folder retrieved successfully
*       404:
*         description: Folder not found
*/
router.get('/:clientId/folders/:folderId', async (req, res) => {
  const folderId = parseInt(req.params.folderId);

  try {
      const folder = await documentRepository.getFolderById(folderId);
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
router.get('/:clientId/documents/:docId/recommendations', verifyToken, async (req: Request, res: Response) => {
  const clientId = parseInt(req.params.clientId);
  const docId = parseInt(req.params.docId);

  if (!clientId || !docId) {
      return res.status(400).json({ message: 'Invalid client ID or document ID' });
  }

  try {
      // Step 1: Fetch document details from the database by clientId and docId
      const document = await documentRepository.findDocumentByClientAndId(clientId, docId);
      if (!document) {
          return res.status(404).json({ message: 'Document not found' });
      }

      // Step 2: Prepare the payload for the external recommendation API
      const payload = {
          input_text: document.docContentUrl,  // Assuming the document URL is used as input
          data_id: docId.toString(),          // Converting docId to string as required
          s3_bucket: process.env.S3_BUCKET_NAME,
          s3_db_path: document.docContentUrl,  // Assuming you use the same path for recommendation
          s3_sentenced_document_path: document.docContentUrl, // Example placeholder
      };

      // Step 3: Make a request to the external recommendation API
      const recommendationResponse = await axios.post('http://18.116.71.195:5000/v1/recommend-bytes', payload);

      // Step 4: Return the document details along with the recommendations
      return res.status(200).json({
          document,
          recommendations: recommendationResponse.data
      });
  } catch (error: any) {
      console.error('Error fetching recommendations:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
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
router.get('/:clientId/bytes/:byteId', verifyToken, async (req: Request, res: Response) => {
  let { clientId, byteId }: any = req.params;

  clientId = parseInt(byteId)
  byteId = parseInt(byteId)

  // Validate clientId, documentId, and byteId
  if (isNaN(parseInt(clientId)) ||  isNaN(parseInt(byteId))) {
    return res.status(400).json({ message: 'Invalid clientId, documentId, or byteId' });
  }

  try {
    const byteRepository = new ByteRepository();

    // Fetch the byte by id, ensuring it belongs to the correct client and document
    const byte = await byteRepository.findByteByClientAndDocument(byteId);

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
  
export default router;