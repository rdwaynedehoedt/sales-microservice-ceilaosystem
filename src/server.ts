import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import clientRoutes from './routes/clients';
import { errorLogger, requestLogger } from './middleware/logging';
import db from './config/database';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

// Configure CORS
const corsOptions = {
  origin: isProduction 
    ? [process.env.CORS_ORIGIN || '', /\.choreoapis\.dev$/] 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for development, consider enabling for production
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'sales-microservice',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/sales/clients', clientRoutes);

// Error handling
app.use(errorLogger);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.path} not found` 
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message,
    stack: isProduction ? undefined : err.stack
  });
});

// Initialize database and start server
(async () => {
  try {
    // First ensure we can connect to the database
    await db.ensureConnection();
    console.log('Database connection verified');
    
    // Start server
    app.listen(port, () => {
      console.log(`Sales microservice is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})(); 