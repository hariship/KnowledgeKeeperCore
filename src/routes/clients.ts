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
 * /load-document:
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
        if(!clientFound || Object.values(clientFound) == null){
          return res.status(400).json(new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.CLIENT_NOT_FOUND))
        }
        client = clientFound
      }else{
        // Create client using clientName
        client = await clientRepo.createClient(clientName)
      }
    }

         
    clientId = client?.id
    clientName = client.clientName


    // Step 2: Upload the file to S3 
    const s3Url = await uploadToS3(file, clientName);

    const savedDocument = await documentRepo.createDocument({
      docContentUrl: s3Url,
      versionNumber: 1.0,
      isTrained: false,
      reTrainingRequired: false,
      updatedAt: new Date(),
      client: clientId
    });
    
    // Step 3: Place a request in RabbitMQ
    await sendMessageToRabbitMQ({
      docId: savedDocument.id,
      versionNumber: savedDocument.versionNumber,
      clientId,
      isTrained: false
    });

    return res.json({
      status: true,
      message: 'Document uploaded successfully',
      document: {
        docId: savedDocument.id,
        versionNumber: savedDocument.versionNumber,
        docUrl: s3Url,
        clientId,
      }
    });
  } catch (error) {
    console.error('Error during document upload:', error);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
});

  
export default router;