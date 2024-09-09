import { Request, Response } from 'express';
import { Router } from 'express';

const router = Router();

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
  
export default router;