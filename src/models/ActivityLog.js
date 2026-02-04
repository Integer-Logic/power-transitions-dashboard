// backend/src/models/ActivityLog.js
const pool = require('../config/database');

class ActivityLog {
  // Create a new activity log entry
  static async create(logData) {
    const {
      actionType,
      entityType,
      userId,
      userName,
      userRole = 'expert',
      entityId,
      entityName,
      changes = [],
      metadata = {},
      ipAddress = null,
      userAgent = null
    } = logData;

    const query = `
      INSERT INTO activity_logs (
        action_type, 
        entity_type, 
        user_id, 
        user_name, 
        user_role, 
        entity_id, 
        entity_name, 
        changes, 
        metadata, 
        ip_address, 
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      actionType,
      entityType,
      userId,
      userName,
      userRole,
      entityId,
      entityName,
      JSON.stringify(changes),
      JSON.stringify(metadata),
      ipAddress,
      userAgent
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating activity log:', error);
      throw error;
    }
  }

  // Get all activity logs with pagination and filtering
  static async findAll(filters = {}, page = 1, limit = 50) {
    const {
      actionType,
      entityType,
      userName,
      entityName,
      startDate,
      endDate,
      search
    } = filters;

    let query = `
      SELECT * FROM activity_logs 
      WHERE 1=1
    `;
    const values = [];
    let valueCount = 0;

    // Build dynamic WHERE clause
    if (actionType) {
      valueCount++;
      query += ` AND action_type = $${valueCount}`;
      values.push(actionType);
    }

    if (entityType) {
      valueCount++;
      query += ` AND entity_type = $${valueCount}`;
      values.push(entityType);
    }

    if (userName) {
      valueCount++;
      query += ` AND user_name ILIKE $${valueCount}`;
      values.push(`%${userName}%`);
    }

    if (entityName) {
      valueCount++;
      query += ` AND entity_name ILIKE $${valueCount}`;
      values.push(`%${entityName}%`);
    }

    if (startDate) {
      valueCount++;
      query += ` AND timestamp >= $${valueCount}`;
      values.push(new Date(startDate).toISOString());
    }

    if (endDate) {
      valueCount++;
      query += ` AND timestamp <= $${valueCount}`;
      values.push(new Date(endDate).toISOString());
    }

    if (search) {
      valueCount++;
      query += ` AND (
        entity_name ILIKE $${valueCount} OR
        user_name ILIKE $${valueCount} OR
        action_type ILIKE $${valueCount}
      )`;
      values.push(`%${search}%`);
    }

    // Order and pagination
    query += ` ORDER BY timestamp DESC`;

    // Count total records
    const countQuery = `SELECT COUNT(*) FROM (${query}) as count_query`;
    const countResult = await pool.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0].count);

    // Add pagination
    valueCount++;
    query += ` LIMIT $${valueCount}`;
    values.push(limit);

    valueCount++;
    query += ` OFFSET $${valueCount}`;
    values.push((page - 1) * limit);

    try {
      const result = await pool.query(query, values);
      return {
        logs: result.rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }
  }

  // Get logs by entity (project)
  static async findByEntity(entityId, entityType = 'project') {
    const query = `
      SELECT * FROM activity_logs 
      WHERE entity_id = $1 AND entity_type = $2
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    try {
      const result = await pool.query(query, [entityId, entityType]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching entity logs:', error);
      throw error;
    }
  }

  // Export logs to CSV/Excel format
  static async export(filters = {}) {
    const { startDate, endDate } = filters;
    
    let query = `
      SELECT 
        timestamp,
        action_type as "actionType",
        user_name as "userName",
        user_role as "userRole",
        entity_name as "entityName",
        entity_type as "entityType",
        changes,
        metadata
      FROM activity_logs 
      WHERE 1=1
    `;
    const values = [];
    let valueCount = 0;

    if (startDate) {
      valueCount++;
      query += ` AND timestamp >= $${valueCount}`;
      values.push(new Date(startDate).toISOString());
    }

    if (endDate) {
      valueCount++;
      query += ` AND timestamp <= $${valueCount}`;
      values.push(new Date(endDate).toISOString());
    }

    query += ` ORDER BY timestamp DESC`;

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error exporting logs:', error);
      throw error;
    }
  }

  // Get statistics
  static async getStats(timeRange = '24h') {
    let interval;
    switch(timeRange) {
      case '1h': interval = '1 hour'; break;
      case '24h': interval = '24 hours'; break;
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      default: interval = '24 hours';
    }

    const query = `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_name) as unique_users,
        COUNT(DISTINCT entity_name) as unique_entities,
        action_type,
        COUNT(*) as action_count
      FROM activity_logs 
      WHERE timestamp >= NOW() - INTERVAL '${interval}'
      GROUP BY action_type
      ORDER BY action_count DESC
    `;

    try {
      const result = await pool.query(query);
      return {
        summary: result.rows[0] || {},
        breakdown: result.rows
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }
}

module.exports = ActivityLog;