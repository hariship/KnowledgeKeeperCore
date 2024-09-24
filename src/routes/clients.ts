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
import { verifyToken } from '../modules/authModule';
import { ByteRepository } from '../repository/ byteRepository';
import { UserRepository } from '../repository/userRepository';
import { UserDetails } from '../entities/user_details';
import { ChangeLogRepository } from '../repository/changeLogRespository';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() }); // Store in memory for easy access

router.get('/clientDetails', (req, res) => {
    // Fetch client details logic
    res.json({
      status: true,
      message: "Client details fetched successfully",
      client: {
        clientId: 1,
        clientName: "Client Name",
        documents: ["Folder1/Document1", "Folder2/Document2"]
      }
    });
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
    let client: Partial<Client> = {};

    if(!clientName && !clientId){
      return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.BAD_CLIENT_REQUEST))
    }

    // Step 1: Create and save document to database
    const documentRepo = new DocumentRepository();
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


    // Step 2: Upload the file to S3 
    const s3Url = await uploadToS3(file, clientName);

    let document = await documentRepo.findDocumentByDocUrl(s3Url);

    console.log(s3Url)

    if(!document || Object.values(document) == null){
      document = await documentRepo.createDocument({
        docContentUrl: s3Url,
        versionNumber: 1.0,
        isTrained: false,
        reTrainingRequired: false,
        updatedAt: new Date(),
        client: clientId
      });
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
      }
    });
  } catch (error) {
    console.error('Error during document upload:', error);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
});


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
  let { userId, docId, byteId,byteInfo, changeRequestType, changes, changeSummary, isTrained } = req.body;

  if (!userId || !docId || !changeRequestType || !changes || !changeSummary || isTrained === undefined) {
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
    byteDetails = await byteRepo.createByte(byteInfo, userDetails)
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

  
export default router;