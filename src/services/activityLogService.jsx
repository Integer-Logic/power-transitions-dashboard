// frontend/src/services/activityLogService.js
import axios from 'axios';

// Action types matching backend
export const ACTION_TYPES = {
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

// Helper to get current user
const getCurrentUser = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return {
    id: user.id || null,
    name: user.name || 'System',
    role: user.role || 'expert'
  };
};

// Log a project creation
export const logProjectCreate = async (project) => {
  const user = getCurrentUser();
  
  try {
    await axios.post('/api/activity-logs/log', {
      action: ACTION_TYPES.PROJECT_CREATE,
      entityId: project['Project Name'],
      entityName: project['Project Name'] || 'New Project',
      entityType: 'project',
      changes: [{
        field: 'created',
        newValue: 'New project created'
      }],
      metadata: {
        projectData: {
          owner: project['Plant Owner'],
          capacity: project['Legacy Nameplate Capacity (MW)'],
          iso: project['ISO'],
          tech: project['Tech']
        }
      },
      user
    });
  } catch (error) {
    console.error('Failed to log project creation:', error);
  }
};

// Log a project update with field-level changes
export const logProjectUpdate = async (projectId, projectName, oldData, newData) => {
  const user = getCurrentUser();
  
  // Calculate changes
  const changes = calculateChanges(oldData, newData);
  
  if (changes.length === 0) {
    return; // No changes to log
  }

  try {
    await axios.post('/api/activity-logs/log', {
      action: ACTION_TYPES.PROJECT_UPDATE,
      entityId: projectId,
      entityName: projectName,
      entityType: 'project',
      changes,
      metadata: {
        changedFields: changes.map(c => c.field),
        changeCount: changes.length
      },
      user
    });
  } catch (error) {
    console.error('Failed to log project update:', error);
  }
};

// Calculate differences between objects
const calculateChanges = (oldData, newData) => {
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

    // Skip internal fields
    if (key.startsWith('_') || key === 'detailData') return;

    changes.push({
      field: key,
      oldValue: formatValue(oldValue),
      newValue: formatValue(newValue),
      timestamp: new Date().toISOString()
    });
  });

  return changes;
};

// Format value for display
const formatValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '(empty)';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (typeof value === 'number') {
    // Format numbers nicely
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toFixed(2);
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  
  return String(value);
};

// Log file upload
export const logFileUpload = async (fileInfo) => {
  const user = getCurrentUser();
  
  try {
    await axios.post('/api/activity-logs/log', {
      action: ACTION_TYPES.FILE_UPLOAD,
      entityId: fileInfo.fileName,
      entityName: `File Upload: ${fileInfo.fileName}`,
      entityType: 'file',
      changes: [{
        field: 'upload',
        newValue: `${fileInfo.rowCount} projects imported`
      }],
      metadata: {
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        rowCount: fileInfo.rowCount,
        importType: fileInfo.importType || 'append'
      },
      user
    });
  } catch (error) {
    console.error('Failed to log file upload:', error);
  }
};

// Log file export
export const logFileExport = async (exportInfo) => {
  const user = getCurrentUser();
  
  try {
    await axios.post('/api/activity-logs/log', {
      action: ACTION_TYPES.FILE_EXPORT,
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
      },
      user
    });
  } catch (error) {
    console.error('Failed to log file export:', error);
  }
};

// Log project deletion
export const logProjectDelete = async (project) => {
  const user = getCurrentUser();
  
  try {
    await axios.post('/api/activity-logs/log', {
      action: ACTION_TYPES.PROJECT_DELETE,
      entityId: project.asset || project['Project Name'],
      entityName: project.asset || project['Project Name'] || 'Unknown Project',
      entityType: 'project',
      changes: [{
        field: 'deleted',
        newValue: 'Project permanently deleted'
      }],
      metadata: {
        projectData: {
          owner: project.owner || project['Plant Owner'],
          capacity: project.mw || project['Legacy Nameplate Capacity (MW)'],
          iso: project.mkt || project['ISO']
        }
      },
      user
    });
  } catch (error) {
    console.error('Failed to log project deletion:', error);
  }
};