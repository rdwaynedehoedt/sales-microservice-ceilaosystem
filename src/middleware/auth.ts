import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';

// Extend Request interface to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

// Interface for decoded token
interface DecodedToken {
  userId: number;
  email: string;
  role: string;
  exp: number;
}

/**
 * Middleware to validate JWT token and check if user has sales role
 */
export const validateSalesAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Option 1: Delegate token validation to main backend
    if (process.env.MAIN_API_URL && process.env.AUTH_ENDPOINT) {
      try {
        // Call main backend to validate token with timeout
        const response = await axios.post(`${process.env.MAIN_API_URL}${process.env.AUTH_ENDPOINT}`, {}, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: 5000 // 5 second timeout
        });

        // Check if user has sales role
        const { user } = response.data;
        if (!user || (user.role !== 'sales' && user.role !== 'admin')) {
          res.status(403).json({ success: false, message: 'Access denied: Sales role required' });
          return;
        }

        // Add user to request object with numeric ID for database compatibility
        req.user = {
          id: user.id.toString(), // Ensure ID is a string for consistency
          email: user.email,
          role: user.role
        };
        
        console.log(`Authenticated user: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
        next();
      } catch (error) {
        // Handle connection errors with main backend - fall back to local validation
        if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.message.includes('Network Error'))) {
          console.warn('Main backend auth service unavailable, falling back to local token validation');
          
          // Fall back to local token validation
          try {
            const secret = process.env.JWT_SECRET || '';
            if (!secret) {
              throw new Error('JWT_SECRET not configured for fallback authentication');
            }
            
            const decoded = jwt.verify(token, secret) as DecodedToken;
            
            // Check if token is expired
            if (decoded.exp < Date.now() / 1000) {
              res.status(401).json({ success: false, message: 'Token expired' });
              return;
            }
            
            // Check if user has sales role
            if (decoded.role !== 'sales' && decoded.role !== 'admin') {
              res.status(403).json({ success: false, message: 'Access denied: Sales role required' });
              return;
            }
            
            // Add user to request object
            req.user = {
              id: decoded.userId.toString(), // Ensure ID is a string for consistency
              email: decoded.email,
              role: decoded.role
            };
            
            console.log(`Authenticated user (fallback): ${decoded.email} (ID: ${decoded.userId}, Role: ${decoded.role})`);
            next();
          } catch (jwtError) {
            res.status(401).json({ success: false, message: 'Invalid token' });
          }
        } 
        // Handle errors from main backend
        else if (axios.isAxiosError(error) && error.response) {
          res.status(error.response.status).json(error.response.data);
        } else {
          console.error('Auth service error:', error);
          res.status(500).json({ success: false, message: 'Authentication service error' });
        }
      }
    }
    // Option 2: Local token validation (fallback if main backend is not available)
    else {
      try {
        // Verify token locally
        const secret = process.env.JWT_SECRET || '';
        if (!secret) {
          throw new Error('JWT_SECRET not configured');
        }
        
        const decoded = jwt.verify(token, secret) as DecodedToken;

        // Check if token is expired
        if (decoded.exp < Date.now() / 1000) {
          res.status(401).json({ success: false, message: 'Token expired' });
          return;
        }

        // Check if user has sales role
        if (decoded.role !== 'sales' && decoded.role !== 'admin') {
          res.status(403).json({ success: false, message: 'Access denied: Sales role required' });
          return;
        }

        // Add user to request object
        req.user = {
          id: decoded.userId.toString(), // Ensure ID is a string for consistency
          email: decoded.email,
          role: decoded.role
        };
        
        console.log(`Authenticated user (local): ${decoded.email} (ID: ${decoded.userId}, Role: ${decoded.role})`);
        next();
      } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid token' });
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}; 