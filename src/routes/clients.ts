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
    
    // Create the client
    const newClient = await ClientModel.createClient(clientData);
    
    res.status(201).json({ 
      success: true, 
      message: 'Client created successfully', 
      data: newClient 
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create client' 
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

/**
 * @route   GET /api/sales/clients
 * @desc    Get all clients for the current sales rep with pagination and search
 * @access  Private (sales, admin)
 */
router.get('/', validateSalesAuth, async (req: Request, res: Response) => {
  try {
    // Get pagination and search parameters from query
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 10;
    const search = req.query.search as string | undefined;
    
    // Ensure we have a valid user ID
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in authentication data'
      });
    }
    
    // Get clients for the current sales rep
    console.log(`Getting clients for sales rep ID: ${req.user.id}, page: ${page}, search: ${search || 'none'}`);
    const { clients, total } = await ClientModel.getAllClientsBySalesRep(
      req.user.id,
      page,
      pageSize,
      search
    );
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.status(200).json({
      success: true,
      data: clients,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error getting clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get clients'
    });
  }
});

export default router; 