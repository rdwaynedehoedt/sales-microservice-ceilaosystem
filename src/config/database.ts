import mssql from 'mssql';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Log database configuration (without sensitive info)
console.log('Database configuration:', {
  server: process.env.AZURE_SQL_SERVER || 'Not set',
  database: process.env.AZURE_SQL_DATABASE || 'Not set',
  user: process.env.AZURE_SQL_USER || 'Not set',
  port: process.env.AZURE_SQL_PORT || '1433',
  // Not logging password for security reasons
});

// Database configuration
const config: mssql.config = {
  server: process.env.AZURE_SQL_SERVER || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  port: parseInt(process.env.AZURE_SQL_PORT || '1433'),
  options: {
    encrypt: true, // For Azure SQL
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Create a connection pool
const pool = new mssql.ConnectionPool(config);
const poolConnect = pool.connect();

// Pool event handlers
pool.on('error', err => {
  console.error('SQL Pool Error:', err);
});

// Database interface
const db = {
  /**
   * Execute a SQL query with parameters
   */
  query: async <T>(text: string, params: any[] = []): Promise<T[]> => {
    await poolConnect; // Ensures the pool has been created
    
    try {
      const request = pool.request();
      
      // Add parameters to the request
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });
      
      // Replace ? with @paramX in the query
      const parameterizedText = text.replace(/\?/g, (_, i) => `@param${i}`);
      
      const result = await request.query(parameterizedText);
      return result.recordset as T[];
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },
  
  /**
   * Ensure the database connection is working
   */
  ensureConnection: async (): Promise<boolean> => {
    try {
      console.log('Testing database connection...');
      await poolConnect;
      const result = await pool.request().query('SELECT 1 as connected');
      console.log('Database connection test result:', result.recordset[0]);
      return result.recordset[0].connected === 1;
    } catch (error) {
      console.error('Database connection error:', error);
      throw new Error(`Failed to connect to database: ${error}`);
    }
  },
  
  /**
   * Close the database connection pool
   */
  close: async (): Promise<void> => {
    try {
      await pool.close();
    } catch (error) {
      console.error('Error closing database connection:', error);
      throw error;
    }
  }
};

export default db; 