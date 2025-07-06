# Sales Microservice for Insurance Brokerage System

This is a lightweight microservice designed specifically for sales personnel to add clients to the insurance brokerage system. It's built to reduce traffic to the main backend by providing a dedicated service for client creation operations.

## Features

- Client creation API for sales personnel
- Authentication delegation to main backend
- Minimal, focused functionality
- Shared database with main backend

## Architecture

This microservice follows a "Standalone Sales Microservice with Auth Delegation" architecture:

- It delegates authentication to the main backend API
- It connects directly to the same Azure SQL Database
- It provides a simplified API for client creation

## Setup Instructions

### Prerequisites

- Node.js and npm installed
- Access to Azure SQL Database
- Main backend API running

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following environment variables:
   ```
   # Server Configuration
   PORT=5001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:3000

   # Main Backend API (for auth delegation)
   MAIN_API_URL=http://localhost:5000
   AUTH_ENDPOINT=/api/auth/validate-token

   # Azure SQL Database Configuration
   AZURE_SQL_SERVER=your-server.database.windows.net
   AZURE_SQL_DATABASE=your_database
   AZURE_SQL_USER=your_username
   AZURE_SQL_PASSWORD=your_password
   AZURE_SQL_PORT=1433

   # Authentication
   JWT_SECRET=your_secret_key
   JWT_EXPIRATION=7d
   ```

4. Start the development server:
   ```
   npm run dev
   ```

### Deployment to WSO2 Choreo

1. Build the project:
   ```
   npm run build
   ```

2. Follow the WSO2 Choreo deployment guidelines
3. Configure environment variables in Choreo

## API Endpoints

### Client Management

- `POST /api/sales/clients` - Create a new client (requires sales role)
- `GET /api/sales/clients/recent` - Get recent clients created by the current user

### System

- `GET /health` - Health check endpoint

## Authentication

This microservice uses token-based authentication with JWT. It delegates token validation to the main backend API to ensure consistent authentication across services.

## Next Steps

1. **Frontend Integration**: Integrate with the frontend to provide a dedicated interface for sales personnel
2. **Expanded Features**: Add more sales-specific features as needed
3. **Monitoring**: Set up monitoring and logging for the microservice
4. **Testing**: Add automated tests for the API endpoints 