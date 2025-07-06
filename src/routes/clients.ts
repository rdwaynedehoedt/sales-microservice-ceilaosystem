import express, { Request, Response } from 'express';
import ClientModel, { Client } from '../models/Client';
import { validateSalesAuth } from '../middleware/auth';
import multer from 'multer';
import { BlobServiceClient } from '@azure/storage-blob';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure Azure Blob Storage
let blobServiceClient: BlobServiceClient;
let containerClient: any;

// Initialize Azure Blob Storage client
const initBlobStorage = async () => {
  try {
    console.log('Initializing Azure Blob Storage client...');
    
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'customer-documents';
    
    if (!connectionString) {
      throw new Error('Azure Storage connection string not configured');
    }
    
    // Create the BlobServiceClient
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    
    // Get a reference to the container
    containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Check if container exists, create if it doesn't
    const containerExists = await containerClient.exists();
    if (!containerExists) {
      console.log(`Creating container: ${containerName}`);
      await containerClient.create();
      console.log(`Container ${containerName} created`);
    } else {
      console.log(`Container ${containerName} exists`);
    }
    
    console.log('Azure Blob Storage client initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing Azure Blob Storage:', error);
    return false;
  }
};

// Initialize storage on startup
initBlobStorage();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper function to upload file to Azure Blob Storage
const uploadToAzure = async (file: Express.Multer.File, clientId: string, documentType: string): Promise<string> => {
  try {
    if (!containerClient) {
      await initBlobStorage();
      if (!containerClient) {
        throw new Error('Failed to initialize Azure Blob Storage');
      }
    }
    
    // Generate unique blob name
    const fileExtension = path.extname(file.originalname);
    const blobName = `${clientId}/${documentType}_${uuidv4()}${fileExtension}`;
    
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Upload file
    await blockBlobClient.upload(file.buffer, file.size);
    
    // Return the URL
    return blockBlobClient.url;
  } catch (error) {
    console.error('Error uploading to Azure Blob Storage:', error);
    throw error;
  }
};

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
 * @route   POST /api/sales/clients/with-documents
 * @desc    Create a new client with document uploads
 * @access  Private (sales, admin)
 */
router.post(
  '/with-documents',
  validateSalesAuth,
  upload.fields([
    { name: 'nic_proof', maxCount: 1 },
    { name: 'dob_proof', maxCount: 1 },
    { name: 'business_registration', maxCount: 1 },
    { name: 'svat_proof', maxCount: 1 },
    { name: 'vat_proof', maxCount: 1 },
    { name: 'coverage_proof', maxCount: 1 },
    { name: 'sum_insured_proof', maxCount: 1 },
    { name: 'policy_fee_invoice', maxCount: 1 },
    { name: 'vat_fee_debit_note', maxCount: 1 },
    { name: 'payment_receipt_proof', maxCount: 1 },
    { name: 'policyholder_doc', maxCount: 1 },
    { name: 'vehicle_number_doc', maxCount: 1 },
    { name: 'proposal_form_doc', maxCount: 1 },
    { name: 'quotation_doc', maxCount: 1 },
    { name: 'cr_copy_doc', maxCount: 1 },
    { name: 'schedule_doc', maxCount: 1 },
    { name: 'invoice_debit_note_doc', maxCount: 1 },
    { name: 'payment_receipt_doc', maxCount: 1 },
    { name: 'nic_br_doc', maxCount: 1 }
  ]),
  async (req: Request, res: Response) => {
    try {
      // Get client data from request body
      const clientData = JSON.parse(req.body.clientData || '{}');
      
      // Validate required fields
      const { customer_type, product, insurance_provider, client_name, mobile_no } = clientData;
      
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
      
      // Generate client ID
      const clientId = `C${uuidv4().substring(0, 8)}`;
      
      // Process uploaded files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const documentUrls: { [key: string]: string } = {};
      
      // Upload each file to Azure Blob Storage
      if (files) {
        for (const [fieldName, fileArray] of Object.entries(files)) {
          if (fileArray && fileArray.length > 0) {
            const file = fileArray[0];
            try {
              const url = await uploadToAzure(file, clientId, fieldName);
              documentUrls[fieldName] = url;
              console.log(`Uploaded ${fieldName} for client ${clientId}`);
            } catch (error) {
              console.error(`Error uploading ${fieldName}:`, error);
            }
          }
        }
      }
      
      // Create client data object with document URLs
      const newClientData: Client = {
        id: clientId,
        ...clientData,
        ...documentUrls,
        sales_rep_id: salesRepId
      };
      
      // Create the client
      const newClient = await ClientModel.createClient(newClientData);
      
      res.status(201).json({ 
        success: true, 
        message: 'Client created successfully with documents', 
        data: newClient 
      });
    } catch (error) {
      console.error('Error creating client with documents:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create client with documents' 
      });
    }
  }
);

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