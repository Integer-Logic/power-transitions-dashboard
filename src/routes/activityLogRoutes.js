// backend/src/routes/activityLogRoutes.js
const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get activity logs with filters
router.get('/', activityLogController.getLogs);

// Get logs for specific entity (project)
router.get('/entity/:entityId', activityLogController.getEntityLogs);

// Get statistics
router.get('/stats', activityLogController.getStats);

// Export logs
router.get('/export', activityLogController.exportLogs);

// Get recent activity (for dashboard widget)
router.get('/recent', activityLogController.getRecent);

module.exports = router;