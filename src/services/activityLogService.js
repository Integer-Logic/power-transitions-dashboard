// backend/src/services/activityLogService.js
const ActivityLog = require('../models/ActivityLog');

class ActivityLogService {
  // Action type constants
  static ACTIONS = {
    PROJECT_CREATE: 'project.create',
    PROJECT_UPDATE: 'project.update',
    PROJECT_DELETE: 'project.delete',
    PROJECT_VIEW: 'project.view',
    
    FILE_UPLOAD: 'file.upload',
    FILE_EXPORT: 'file.export',
    
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    
    BATCH_UPDATE: 'batch.update'
  };

  // Create a standardized log entry
  static async log(action, data, user = {}) {
    const {
      entityId,
      entityName,
      entityType = 'project',
      changes = [],
      metadata = {},
      ipAddress,
      userAgent
    } = data;

    const logData = {
      actionType: action,
      entityType,
      userId: user.id || null,
      userName: user.name || 'System',
      userRole: user.role || 'expert',
      entityId,
      entityName,
      changes: Array.isArray(changes) ? changes : [changes],
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'web-dashboard'
      },
      ipAddress,
      userAgent
    };

    return await ActivityLog.create(logData);
  }

  // Log project creation
  static async logProjectCreate(project, user) {
    return this.log(this.ACTIONS.PROJECT_CREATE, {
      entityId: project.id || project['Project Name'],
      entityName: project['Project Name'] || 'Unknown Project',
      entityType: 'project',
      changes: [{ field: 'created', newValue: 'New project created' }],
      metadata: {
        projectData: {
          owner: project['Plant Owner'],
          capacity: project['Legacy Nameplate Capacity (MW)'],
          iso: project['ISO']
        }
      }
    }, user);
  }

  // Log project update with field-level changes
  static async logProjectUpdate(projectId, projectName, oldData, newData, user) {
    const changes = this.calculateChanges(oldData, newData);
    
    if (changes.length === 0) {
      return null; // No changes to log
    }

    return this.log(this.ACTIONS.PROJECT_UPDATE, {
      entityId: projectId,
      entityName: projectName,
      entityType: 'project',
      changes,
      metadata: {
        changedFields: changes.map(c => c.field),
        changeCount: changes.length
      }
    }, user);
  }

  // Calculate differences between old and new data
  static calculateChanges(oldData, newData) {
    const changes = [];
    const allKeys = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {})
    ]);

    allKeys.forEach(key => {
      const oldValue = oldData?.[key];
      const newValue = newData?.[key];

      // Skip if values are equal or both undefined/null
      if (oldValue === newValue) return;
      if (!oldValue && !newValue) return;

      // Format the values for display
      const formatValue = (val) => {
        if (val === null || val === undefined) return '(empty)';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      };

      changes.push({
        field: key,
        oldValue: formatValue(oldValue),
        newValue: formatValue(newValue),
        timestamp: new Date().toISOString()
      });
    });

    return changes;
  }

  // Log file upload
  static async logFileUpload(fileInfo, user) {
    return this.log(this.ACTIONS.FILE_UPLOAD, {
      entityId: fileInfo.fileName,
      entityName: `File: ${fileInfo.fileName}`,
      entityType: 'file',
      changes: [{
        field: 'upload',
        newValue: `${fileInfo.rowCount} rows imported`
      }],
      metadata: {
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        rowCount: fileInfo.rowCount,
        importType: fileInfo.importType
      }
    }, user);
  }

  // Log file export
  static async logFileExport(exportInfo, user) {
    return this.log(this.ACTIONS.FILE_EXPORT, {
      entityId: exportInfo.exportType,
      entityName: `Export: ${exportInfo.exportType}`,
      entityType: 'file',
      changes: [{
        field: 'export',
        newValue: `${exportInfo.projectCount} projects exported`
      }],
      metadata: {
        exportType: exportInfo.exportType,
        projectCount: exportInfo.projectCount,
        filters: exportInfo.filters || {},
        format: exportInfo.format || 'excel'
      }
    }, user);
  }
}

module.exports = ActivityLogService;