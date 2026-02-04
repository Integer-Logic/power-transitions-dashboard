
const { Pool } = require('pg');
require('dotenv').config();

class DatabaseConfig {
  constructor() {
    this.validateEnvironment();
    this.pool = this.createPool();
    this.setupEventListeners();
  }

  validateEnvironment() {
    // Always require NODE_ENV
    if (!process.env.NODE_ENV) {
      throw new Error('NODE_ENV environment variable is required');
    }

    // In production, require DATABASE_URL
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required in production');
    }

    // In development, require individual DB vars if no DATABASE_URL
    if (process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL) {
      const devVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
      const missing = devVars.filter(v => !process.env[v]);
      if (missing.length > 0) {
        throw new Error(`Missing database configuration for development: ${missing.join(', ')}`);
      }
    }
  }

  createPool() {
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    
    // Option 1: Use DATABASE_URL (recommended for both dev and prod)
    if (process.env.DATABASE_URL) {
      console.log('🔗 Database: Using DATABASE_URL from environment');
      
      const sslConfig = process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false,  
        require: true              
      } : false;

      return new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }

    console.log('🔗 Database: Using development configuration');
    
    return new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: false,  // Local PostgreSQL usually doesn't need SSL
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  setupEventListeners() {
    this.pool.on('connect', () => {
      console.log('✅ Database connection established');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database connection error:', err.message);
    });
  }

  getPool() {
    return this.pool;
  }

  async testConnection() {
    try {
      const result = await this.pool.query('SELECT NOW() as current_time, version() as db_version');
      return {
        connected: true,
        timestamp: result.rows[0].current_time,
        version: result.rows[0].db_version,
        environment: process.env.NODE_ENV
      };
    } catch (error) {
      console.error('❌ Database connection test failed:', error.message);
      return {
        connected: false,
        error: error.message,
        environment: process.env.NODE_ENV
      };
    }
  }

  async close() {
    await this.pool.end();
    console.log('🔌 Database connection pool closed');
  }
}

// Create and export singleton instance
const database = new DatabaseConfig();
module.exports = database;
