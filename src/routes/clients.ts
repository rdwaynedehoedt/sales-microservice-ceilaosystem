import express, { Request, Response } from 'express';
import ClientModel, { Client } from '../models/Client';
import { validateSalesAuth } from '../middleware/auth';

const router = express.Router();

/**
 * @route   POST /api/sales/clients
 * @desc    Create a new client (sales role only)
 * @access  Private (sales, admin)
 */
router.post('/', validateSalesAuth, async (req: Request, res: Response) => {
  try {
    // Validate required fields based on main backend requirements
    const { customer_type, product, insurance_provider, client_name, mobile_no } = req.body;
    
    if (!customer_type || !product || !insurance_provider || !client_name || !mobile_no) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: customer_type, product, insurance_provider, client_name, mobile_no' 
      });
    }
    
    // Check for duplicate client
    const isDuplicate = await ClientModel.checkDuplicate(client_name, insurance_provider);
    if (isDuplicate) {
      return res.status(409).json({ 
        success: false, 
        message: 'A client with this name and insurance provider already exists' 
      });
    }
    
    // Ensure we have a valid user ID
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in authentication data'
      });
    }
    
    // Convert string ID to number for sales_rep_id
    const salesRepId = parseInt(req.user.id);
    if (isNaN(salesRepId)) {
      return res.status(500).json({
        success: false,
        message: 'Invalid sales rep ID format'
      });
    }
    
    // Create client with sales rep ID from auth middleware
    const clientData: Client = {
      ...req.body,
      sales_rep_id: salesRepId
    };
    
    // Log the client data being sent to the database
    console.log(`Creating client for sales rep ID: ${salesRepId} (${req.user.email})`);
    
    const newClient = await ClientModel.createClient(clientData);
    
    res.status(201).json({ 
      success: true, 
      message: 'Client created successfully', 
      data: newClient 
    });
  } catch (error) {
    console.error('Error creating client:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to create client';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage 
    });
  }
});

/**
 * @route   GET /api/sales/clients/recent
 * @desc    Get recent clients created by the current user
 * @access  Private (sales, admin)
 */
router.get('/recent', validateSalesAuth, async (req: Request, res: Response) => {
  try {
    // Get limit from query params or use default
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    // Ensure we have a valid user ID
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in authentication data'
      });
    }
    
    // Convert string ID to number for sales_rep_id
    const salesRepId = parseInt(req.user.id);
    if (isNaN(salesRepId)) {
      return res.status(500).json({
        success: false,
        message: 'Invalid sales rep ID format'
      });
    }
    
    // Get clients created by the current sales rep
    console.log(`Getting recent clients for sales rep ID: ${salesRepId}`);
    const clients = await ClientModel.getClientsByCreator(salesRepId.toString(), limit);
    
    res.status(200).json({ 
      success: true, 
      count: clients.length, 
      data: clients 
    });
  } catch (error) {
    console.error('Error getting recent clients:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get recent clients' 
    });
  }
});

export default router; 