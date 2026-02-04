// backend/src/controllers/activityLogController.js
const ActivityLog = require('../models/ActivityLog');
const ActivityLogService = require('../services/activityLogService');
const { Parser } = require('json2csv');

// Get logs with filters
exports.getLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      actionType, 
      entityType, 
      userName, 
      entityName, 
      startDate, 
      endDate,
      search 
    } = req.query;

    const filters = {
      actionType,
      entityType,
      userName,
      entityName,
      startDate,
      endDate,
      search
    };

    const result = await ActivityLog.findAll(filters, parseInt(page), parseInt(limit));
    
    res.json({
      success: true,
      data: result.logs,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
      error: error.message
    });
  }
};

// Get logs for specific entity
exports.getEntityLogs = async (req, res) => {
  try {
    const { entityId } = req.params;
    const { entityType = 'project' } = req.query;

    const logs = await ActivityLog.findByEntity(entityId, entityType);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching entity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entity logs',
      error: error.message
    });
  }
};

// Get statistics
exports.getStats = async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    const stats = await ActivityLog.getStats(timeRange);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// Export logs to CSV or Excel
exports.exportLogs = async (req, res) => {
  try {
    const { format = 'csv', startDate, endDate } = req.query;
    
    const filters = { startDate, endDate };
    const logs = await ActivityLog.export(filters);

    if (format === 'csv') {
      // Convert to CSV
      const fields = [
        { label: 'Timestamp', value: 'timestamp' },
        { label: 'Action', value: 'actionType' },
        { label: 'User', value: 'userName' },
        { label: 'Role', value: 'userRole' },
        { label: 'Entity', value: 'entityName' },
        { label: 'Entity Type', value: 'entityType' },
        { label: 'Changes', value: row => JSON.stringify(row.changes) },
        { label: 'Metadata', value: row => JSON.stringify(row.metadata) }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(logs);

      res.header('Content-Type', 'text/csv');
      res.attachment(`activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } else if (format === 'json') {
      // Return as JSON
      res.json({
        success: true,
        data: logs,
        metadata: {
          exportDate: new Date().toISOString(),
          recordCount: logs.length
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format. Use "csv" or "json"'
      });
    }
  } catch (error) {
    console.error('Error exporting logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export logs',
      error: error.message
    });
  }
};

// Get recent activity for dashboard
exports.getRecent = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await ActivityLog.findAll({}, 1, parseInt(limit));
    
    res.json({
      success: true,
      data: result.logs
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: error.message
    });
  }
};