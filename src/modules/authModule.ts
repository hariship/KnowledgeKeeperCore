import { NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';

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