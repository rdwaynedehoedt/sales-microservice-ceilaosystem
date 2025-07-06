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
  street1?: string;
  street2?: string;
  city?: string;
  district?: string;
  province?: string;
  telephone?: string;
  mobile_no: string;  // Required field
  contact_person?: string;
  email?: string;
  social_media?: string;
  
  // Document proofs
  nic_proof?: string;
  dob_proof?: string;
  business_registration?: string;
  svat_proof?: string;
  vat_proof?: string;
  coverage_proof?: string;
  sum_insured_proof?: string;
  policy_fee_invoice?: string;
  vat_fee_debit_note?: string;
  payment_receipt_proof?: string;
  
  // Additional text-only fields
  ceilao_ib_file_no?: string;
  main_class?: string;
  insurer?: string;
  
  // Document + text fields
  policyholder_doc?: string;
  policyholder_text?: string;
  vehicle_number_doc?: string;
  vehicle_number_text?: string;
  proposal_form_doc?: string;
  proposal_form_text?: string;
  quotation_doc?: string;
  quotation_text?: string;
  cr_copy_doc?: string;
  cr_copy_text?: string;
  schedule_doc?: string;
  schedule_text?: string;
  invoice_debit_note_doc?: string;
  invoice_debit_note_text?: string;
  payment_receipt_doc?: string;
  payment_receipt_text?: string;
  nic_br_doc?: string;
  nic_br_text?: string;
  
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
  debit_note?: string;
  payment_receipt?: string;
  
  // Commission details
  commission_type?: string;
  commission_basic?: number;
  commission_srcc?: number;
  commission_tc?: number;
  
  // Additional fields
  sales_rep_id?: number;
  policies?: number;
  created_at?: Date;
  updated_at?: Date;
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
  },

  /**
   * Get all clients for a sales rep with pagination and optional search
   */
  getAllClientsBySalesRep: async (
    salesRepId: string, 
    page: number = 1, 
    pageSize: number = 10, 
    search?: string
  ): Promise<{clients: Client[], total: number}> => {
    try {
      // Convert string ID to number
      const numericSalesRepId = parseInt(salesRepId);
      if (isNaN(numericSalesRepId)) {
        throw new Error(`Invalid sales rep ID: ${salesRepId}`);
      }

      // Calculate offset for pagination
      const offset = (page - 1) * pageSize;
      
      let countQuery: string;
      let dataQuery: string;
      let params: any[] = [numericSalesRepId];
      
      if (search && search.trim() !== '') {
        // Add search parameter
        params.push(`%${search}%`);
        
        // Count query with search
        countQuery = `
          SELECT COUNT(*) as total
          FROM clients 
          WHERE sales_rep_id = @param0
          AND (
            client_name LIKE @param1 OR
            email LIKE @param1 OR
            mobile_no LIKE @param1 OR
            product LIKE @param1 OR
            insurance_provider LIKE @param1 OR
            policy_no LIKE @param1
          )
        `;
        
        // Data query with search
        dataQuery = `
          SELECT *
          FROM clients 
          WHERE sales_rep_id = @param0
          AND (
            client_name LIKE @param1 OR
            email LIKE @param1 OR
            mobile_no LIKE @param1 OR
            product LIKE @param1 OR
            insurance_provider LIKE @param1 OR
            policy_no LIKE @param1
          )
          ORDER BY created_at DESC
          OFFSET ${offset} ROWS
          FETCH NEXT ${pageSize} ROWS ONLY
        `;
      } else {
        // Count query without search
        countQuery = `
          SELECT COUNT(*) as total
          FROM clients 
          WHERE sales_rep_id = @param0
        `;
        
        // Data query without search
        dataQuery = `
          SELECT *
          FROM clients 
          WHERE sales_rep_id = @param0
          ORDER BY created_at DESC
          OFFSET ${offset} ROWS
          FETCH NEXT ${pageSize} ROWS ONLY
        `;
      }
      
      // Execute count query
      const countResult = await db.query<{total: number}>(countQuery, params);
      const total = countResult[0]?.total || 0;
      
      // Execute data query
      const clients = await db.query<Client>(dataQuery, params);
      
      return { clients, total };
    } catch (error) {
      console.error('Error getting all clients by sales rep:', error);
      throw error;
    }
  }
}; 