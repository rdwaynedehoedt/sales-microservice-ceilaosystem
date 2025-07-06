import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

// Client interface matching the actual database schema
export interface Client {
  id?: string;
  introducer_code?: string;
  customer_type: string;
  product: string;
  policy_?: string;
  insurance_provider: string;
  branch?: string;
  client_name: string;
  mobile_no: string;  // Required field
  street1?: string;
  street2?: string;
  city?: string;
  district?: string;
  province?: string;
  telephone?: string;
  contact_person?: string;
  email?: string;
  social_media?: string;
  // Document proofs
  nic_proof?: string;
  dob_proof?: string;
  business_registration?: string;
  // Policy details
  policy_type?: string;
  policy_no?: string;
  policy_period_from?: string;
  policy_period_to?: string;
  coverage?: string;
  sum_insured?: number;
  // Financial details
  basic_premium?: number;
  srcc_premium?: number;
  tc_premium?: number;
  net_premium?: number;
  stamp_duty?: number;
  admin_fees?: number;
  road_safety_fee?: number;
  policy_fee?: number;
  vat_fee?: number;
  total_invoice?: number;
  // Additional fields
  sales_rep_id?: number;
  created_at?: Date; // This exists in the database
}

// Client model with database operations
export default {
  /**
   * Create a new client
   */
  createClient: async (clientData: Client): Promise<Client> => {
    try {
      // Generate UUID if not provided - use same format as main backend
      const clientId = clientData.id || `C${uuidv4().substring(0, 8)}`;
      
      // Set the ID in the data
      const dataWithId = {
        id: clientId,
        ...clientData,
        created_at: new Date() // Set current date for created_at
      };
      
      // Create a clean copy of data without undefined values
      const cleanData: any = {};
      Object.entries(dataWithId).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      });
      
      // Generate fields for the SQL query
      const fields = Object.keys(cleanData).join(', ');
      
      // Generate parameter placeholders for SQL Server (@p1, @p2, etc.)
      const paramNames = Object.keys(cleanData).map((_, i) => `@param${i}`).join(', ');
      
      // Query parameters
      const params = Object.values(cleanData);
      
      // Log the SQL query being executed
      console.log(`Creating client with ID: ${clientId}, Sales Rep ID: ${clientData.sales_rep_id || 'none'}`);
      
      // SQL query for inserting a new client
      const query = `
        INSERT INTO clients (${fields}) 
        VALUES (${paramNames});
        SELECT * FROM clients WHERE id = @param0;
      `;
      
      // Execute query
      const result = await db.query<Client>(query, params);
      
      if (result && result.length > 0) {
        return result[0];
      }
      
      throw new Error('Failed to create client');
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  },
  
  /**
   * Check if a client with the same name and provider already exists
   */
  checkDuplicate: async (clientName: string, insuranceProvider: string): Promise<boolean> => {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM clients 
        WHERE client_name = @param0 
        AND insurance_provider = @param1
      `;
      
      const result = await db.query<{ count: number }>(query, [clientName, insuranceProvider]);
      
      return result[0].count > 0;
    } catch (error) {
      console.error('Error checking for duplicate client:', error);
      throw error;
    }
  },
  
  /**
   * Get clients created by a sales rep
   */
  getClientsByCreator: async (salesRepId: string, limit: number = 10): Promise<Client[]> => {
    try {
      // Convert string ID to number
      const numericSalesRepId = parseInt(salesRepId);
      if (isNaN(numericSalesRepId)) {
        throw new Error(`Invalid sales rep ID: ${salesRepId}`);
      }
      
      const query = `
        SELECT TOP ${limit} * 
        FROM clients 
        WHERE sales_rep_id = @param0
        ORDER BY created_at DESC
      `;
      
      return await db.query<Client>(query, [numericSalesRepId]);
    } catch (error) {
      console.error('Error getting clients by creator:', error);
      throw error;
    }
  }
}; 