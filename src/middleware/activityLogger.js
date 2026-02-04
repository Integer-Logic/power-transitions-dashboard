// backend/src/middleware/activityLogger.js
const ActivityLogService = require('../services/activityLogService');

// Middleware to automatically log HTTP requests
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // Don't log static assets or health checks
    if (!req.path.includes('/api/') || req.path === '/api/health') {
      return originalEnd.apply(res, args);
    }

    // Extract user info from request (adjust based on your auth)
    const user = {
      id: req.user?.id || null,
      name: req.user?.name || req.ip || 'Unknown',
      role: req.user?.role || 'guest'
    };

    // Determine action type based on HTTP method
    let actionType;
    switch(req.method) {
      case 'POST': actionType = 'create'; break;
      case 'PUT': 
      case 'PATCH': actionType = 'update'; break;
      case 'DELETE': actionType = 'delete'; break;
      default: actionType = 'view';
    }

    // Log the request (async, don't wait for it)
    ActivityLogService.log(
      `${req.baseUrl.replace('/api/', '')}.${actionType}`,
      {
        entityId: req.params.id || req.body?.id,
        entityName: req.path,
        entityType: 'api',
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          query: req.query,
          body: req.method !== 'GET' ? req.body : undefined
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      },
      user
    ).catch(err => {
      console.error('Failed to log request:', err);
    });

    return originalEnd.apply(res, args);
  };

  next();
};

// Middleware to log specific actions
const logAction = (action, getEntityData) => {
  return async (req, res, next) => {
    try {
      const user = req.user || { name: 'System', role: 'system' };
      const entityData = getEntityData ? getEntityData(req) : {};
      
      await ActivityLogService.log(action, {
        ...entityData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }, user);
      
      next();
    } catch (error) {
      console.error('Error logging action:', error);
      next(); // Don't block the request if logging fails
    }
  };
};

module.exports = {
  requestLogger,
  logAction
};