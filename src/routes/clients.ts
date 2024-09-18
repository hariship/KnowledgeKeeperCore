import { Request, Response, Router } from 'express';
import { AppDataSource } from '../db/data_source';
import { Document } from '../entities/document'; // Your document entity
import { Client } from '../entities/client';
import multer from 'multer';
import { extractHeadersFromHtml, sendMessageToKafka, uploadToS3 } from '../modules/s3Module';
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
 * /api/v1/load-document:
 *   post:
 *     summary: "Upload an HTML document to S3, extract headers, and place a request in Kafka"
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
 *                     clientId:
 *                       type: integer
 *                       example: 456
 *       400:
 *         description: "Bad request"
 */
router.post('/api/v1/load-document', verifyToken, upload.single('file'), async (req: Request, res: Response) => {
  const file = req?.file;

  if (!file) {
    return res.status(400).json({ status: false, message: 'No file uploaded' });
  }

  try {
    // Step 1: Upload the file to S3
    const s3Url = await uploadToS3(file);
    let clientId = req.body?.clientId

    // Step 2: Create and save document to database
    const documentRepo = new DocumentRepository();
    const clientRepo = new ClientRepository();
    const clientExists = await clientRepo.findClientById(clientId)
    if(!clientExists){
      return new KnowledgeKeeperError(KNOWLEDGE_KEEPER_ERROR.CLIENT_NOT_FOUND)
    }
    const savedDocument = await documentRepo.createDocument({
      docContentUrl: s3Url,
      versionNumber: 1.0,
      isTrained: false,
      reTrainingRequired: false,
      updatedAt: new Date(),
      client: clientId
    });
    
    // Step 3: Place a request in Kafka
    await sendMessageToKafka({
      docId: savedDocument.id,
      versionNumber: savedDocument.versionNumber,
      clientId: savedDocument.client.id
    });

    return res.json({
      status: true,
      message: 'Document uploaded successfully',
      document: {
        docId: savedDocument.id,
        versionNumber: savedDocument.versionNumber,
        clientId: savedDocument.client.id
      }
    });
  } catch (error) {
    console.error('Error during document upload:', error);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
});

  
export default router;