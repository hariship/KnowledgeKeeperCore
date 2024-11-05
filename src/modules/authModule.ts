import { NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { UserTeamspaceRepository } from "../repository/userTeamspaceRepository";
import { DocumentRepository } from "../repository/documentRepository";

export const verifyTeamspaceAccess = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.userId; // Assuming `userId` is set after authentication
    const { folderId, docId } = req.params;

    let teamspaceId: number | undefined;

    // Determine teamspaceId from folderId or docId
    if (folderId) {
      const documentRepo = new DocumentRepository();
      const folder = await documentRepo.findFolderById(parseInt(folderId));
      teamspaceId = folder?.teamspace?.id;
    } else if (docId) {
      const documentRepo = new DocumentRepository();
      const document = await documentRepo.findDocumentById(parseInt(docId));
      teamspaceId = document?.teamspace?.id;
    }

    if (!teamspaceId) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid folderId or docId, or teamspace not found.',
      });
    }

    // Validate user access to the teamspace
    const userTeamspaceRepo = new UserTeamspaceRepository();
    const hasAccess = await userTeamspaceRepo.checkUserAccessToTeamspace(userId, teamspaceId);

    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied. User does not have access to the specified teamspace.',
      });
    }
    next(); // Proceed if the user has access
  } catch (error) {
    console.error('Error verifying teamspace access:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Middleware to verify JWT token
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization'] || '';
  
    if (!token) {
      return res.status(403).json({ status: false, message: 'No token provided' });
    }
  
    try {
      const jwtSecret = process.env.JWT_SECRET || '';
      const decoded = jwt.verify(token.split(' ')[1], jwtSecret);  // Remove "Bearer " prefix
      (req as any).user = decoded;  // Attach the decoded user information to the request
      next();
    } catch (error) {
      return res.status(401).json({ status: false, message: 'Invalid token' });
    }
  };

  export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];
  
    // Check if the API key is provided
    if (!apiKey) {
      return res.status(403).json({ status: false, message: 'No API key provided' });
    }
  
    // Verify API key (replace this with your logic, e.g., checking against a list of valid API keys)
    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ status: false, message: 'Invalid API key' });
    }
  
    // If the API key is valid, proceed to the next middleware or route handler
    next();
  };