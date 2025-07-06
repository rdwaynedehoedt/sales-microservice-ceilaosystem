/**
 * Test script for client creation via sales microservice
 * 
 * This script:
 * 1. Authenticates with the main backend
 * 2. Uses the token to create a client through the sales microservice
 * 3. Verifies the client was created successfully
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const MAIN_API_URL = process.env.MAIN_API_URL || 'http://localhost:5000';
const SALES_API_URL = process.env.SALES_API_URL || 'http://localhost:5001';
const AUTH_ENDPOINT = '/api/auth/login';
const CLIENT_ENDPOINT = '/api/sales/clients';

// Test user credentials
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'sales@example.com',
  password: process.env.TEST_USER_PASSWORD || 'Sales@123'
};

// Test client data
const TEST_CLIENT = {
  customer_type: 'Individual',
  product: 'Health Insurance',
  insurance_provider: 'Test Insurance Co',
  client_name: `Test Client ${new Date().toISOString()}`,
  mobile_no: '1234567890',
  email: 'testclient@example.com'
};

/**
 * Main test function
 */
async function runTest() {
  console.log('🔍 Starting client creation test...');
  
  try {
    // Step 1: Authenticate with main backend
    console.log('\n📡 Authenticating with main backend...');
    const authResponse = await axios.post(`${MAIN_API_URL}${AUTH_ENDPOINT}`, TEST_USER);
    
    // Check if token exists in response (actual format from your API)
    if (!authResponse.data.token) {
      throw new Error('Authentication failed: ' + JSON.stringify(authResponse.data));
    }
    
    const token = authResponse.data.token;
    console.log('✅ Authentication successful! Token received.');
    console.log('👤 User:', authResponse.data.user ? `${authResponse.data.user.firstName} ${authResponse.data.user.lastName} (${authResponse.data.user.role})` : 'Unknown');
    
    // Step 2: Create client using sales microservice
    console.log('\n📡 Creating client through sales microservice...');
    const clientResponse = await axios.post(
      `${SALES_API_URL}${CLIENT_ENDPOINT}`,
      TEST_CLIENT,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!clientResponse.data.success) {
      throw new Error('Client creation failed: ' + JSON.stringify(clientResponse.data));
    }
    
    const newClient = clientResponse.data.data;
    console.log('✅ Client created successfully!');
    console.log('📋 Client details:');
    console.log(JSON.stringify(newClient, null, 2));
    
    // Step 3: Verify client was created by fetching recent clients
    console.log('\n📡 Verifying client creation by fetching recent clients...');
    const recentClientsResponse = await axios.get(
      `${SALES_API_URL}${CLIENT_ENDPOINT}/recent`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!recentClientsResponse.data.success) {
      throw new Error('Failed to fetch recent clients: ' + JSON.stringify(recentClientsResponse.data));
    }
    
    const recentClients = recentClientsResponse.data.data;
    const foundClient = recentClients.find(client => client.id === newClient.id);
    
    if (foundClient) {
      console.log('✅ Client verification successful! Client found in recent clients list.');
      console.log('🎉 TEST PASSED: Client creation is working correctly!');
    } else {
      console.log('❌ Client verification failed! Client not found in recent clients list.');
      console.log('Recent clients:');
      console.log(JSON.stringify(recentClients, null, 2));
      throw new Error('Client verification failed');
    }
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run the test
runTest(); 