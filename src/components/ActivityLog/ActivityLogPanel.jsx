import React, { useState, useEffect } from 'react';
import { useActivityLog } from '../../contexts/ActivityLogContext';
import './ActivityLogPanel.css';

const ActivityLogPanel = () => {
  const { activities = [], clearActivities } = useActivityLog();
  const [filters, setFilters] = useState({
    actionType: '',
    userName: '',
    entityName: '',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [page, setPage] = useState(1);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const itemsPerPage = 20;

  // Filter activities when filters change
  useEffect(() => {
    let filtered = [...activities];
    
    // Filter by action type
    if (filters.actionType) {
      filtered = filtered.filter(activity => 
        activity.action.toLowerCase().includes(filters.actionType.toLowerCase())
      );
    }
    
    // Filter by user name
    if (filters.userName) {
      filtered = filtered.filter(activity => 
        activity.user.toLowerCase().includes(filters.userName.toLowerCase())
      );
    }
    
    // Filter by project name
    if (filters.entityName) {
      filtered = filtered.filter(activity => 
        activity.projectName.toLowerCase().includes(filters.entityName.toLowerCase())
      );
    }
    
    // Filter by start date
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(activity => 
        new Date(activity.timestamp) >= start
      );
    }
    
    // Filter by end date
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(activity => 
        new Date(activity.timestamp) <= end
      );
    }
    
    // General search across all fields
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(activity => 
        activity.user.toLowerCase().includes(searchLower) ||
        activity.action.toLowerCase().includes(searchLower) ||
        activity.projectName.toLowerCase().includes(searchLower) ||
        JSON.stringify(activity.details || '').toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredActivities(filtered);
    setPage(1);
  }, [filters, activities]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedActivities = filteredActivities.slice(startIndex, startIndex + itemsPerPage);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    try {
      const exportData = filteredActivities.map(activity => ({
        Timestamp: activity.timestamp,
        User: activity.user,
        Action: activity.action,
        Project: activity.projectName,
        Details: JSON.stringify(activity.details || {})
      }));
      
      const csvContent = [
        ['Timestamp', 'User', 'Action', 'Project', 'Details'].join(','),
        ...exportData.map(row => [
          `"${row.Timestamp}"`,
          `"${row.User}"`,
          `"${row.Action}"`,
          `"${row.Project}"`,
          `"${row.Details}"`
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity-log-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  const handleResetFilters = () => {
    setFilters({
      actionType: '',
      userName: '',
      entityName: '',
      startDate: '',
      endDate: '',
      search: ''
    });
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getActionIcon = (action) => {
    const actionLower = (action || '').toLowerCase();
    if (actionLower.includes('add') || actionLower.includes('create')) return '➕';
    if (actionLower.includes('edit') || actionLower.includes('update')) return '✏️';
    if (actionLower.includes('delete')) return '🗑️';
    if (actionLower.includes('view')) return '👁️';
    if (actionLower.includes('export')) return '📤';
    if (actionLower.includes('import') || actionLower.includes('upload')) return '📥';
    if (actionLower.includes('filter')) return '🔍';
    return '📝';
  };

  const getActionColor = (action) => {
    const actionLower = (action || '').toLowerCase();
    if (actionLower.includes('add') || actionLower.includes('create')) return '#10b981';
    if (actionLower.includes('edit') || actionLower.includes('update')) return '#3b82f6';
    if (actionLower.includes('delete')) return '#ef4444';
    if (actionLower.includes('view')) return '#8b5cf6';
    if (actionLower.includes('export')) return '#f59e0b';
    if (actionLower.includes('import') || actionLower.includes('upload')) return '#ec4899';
    return '#6b7280';
  };

  // Calculate stats
  const calculateStats = () => {
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);
    
    const last24hActivities = activities.filter(activity => 
      new Date(activity.timestamp || Date.now()) >= last24h
    );
    
    const uniqueUsers = [...new Set(last24hActivities.map(a => a.user || 'Unknown'))];
    const uniqueProjects = [...new Set(last24hActivities.map(a => a.projectName || 'Unknown'))];
    
    return {
      total_actions: last24hActivities.length,
      unique_users: uniqueUsers.length,
      unique_entities: uniqueProjects.length
    };
  };

  const stats = calculateStats();

  // Add sample data button for testing
  const addSampleData = () => {
    const sampleActions = ['Project Added', 'Project Updated', 'Project Deleted', 'File Exported', 'Filter Applied'];
    const sampleProjects = ['Shoemaker Plant', 'Hillburn Station', 'Massena Facility', 'Ogdensburg Project'];
    const sampleUsers = ['admin', 'manager', 'analyst', 'viewer'];
    
    for (let i = 0; i < 5; i++) {
      const action = sampleActions[Math.floor(Math.random() * sampleActions.length)];
      const project = sampleProjects[Math.floor(Math.random() * sampleProjects.length)];
      const user = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
      
      const details = {
        changes: Math.floor(Math.random() * 5) + 1,
        field: ['Capacity', 'Owner', 'Location', 'Tech', 'Score'][Math.floor(Math.random() * 5)]
      };
      
      // Simulate logActivity call
      const newActivity = {
        id: Date.now() + i,
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Random time in last 24h
        user,
        action,
        projectName: project,
        details
      };
      
      // Update localStorage
      const savedActivities = JSON.parse(localStorage.getItem('activityLog') || '[]');
      savedActivities.unshift(newActivity);
      localStorage.setItem('activityLog', JSON.stringify(savedActivities.slice(0, 100)));
    }
    
    // Refresh page to see new data
    window.location.reload();
  };

  return (
    <div className="activity-log-panel">
      <div className="panel-header">
        <h2>📊 Activity Log</h2>
        <div className="header-actions">
          {activities.length === 0 && (
            <button className="add-sample-btn" onClick={addSampleData} style={{ background: '#8b5cf6' }}>
              Add Sample Data
            </button>
          )}
          <button className="export-btn" onClick={handleExport} disabled={filteredActivities.length === 0}>
            Export CSV
          </button>
          <button className="clear-btn" onClick={clearActivities} disabled={activities.length === 0}>
            Clear All
          </button>
          <button className="refresh-btn" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-summary">
        <div className="stat-card">
          <span className="stat-value">{stats.total_actions}</span>
          <span className="stat-label">Total Actions (24h)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.unique_users}</span>
          <span className="stat-label">Active Users</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.unique_entities}</span>
          <span className="stat-label">Projects Affected</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{activities.length}</span>
          <span className="stat-label">Total Logs</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Action Type</label>
            <select 
              value={filters.actionType}
              onChange={(e) => handleFilterChange('actionType', e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="add">Add/Create</option>
              <option value="update">Update/Edit</option>
              <option value="delete">Delete</option>
              <option value="view">View</option>
              <option value="export">Export</option>
              <option value="import">Import/Upload</option>
              <option value="filter">Filter</option>
            </select>
          </div>

          <div className="filter-group">
            <label>User</label>
            <input
              type="text"
              placeholder="Search by user..."
              value={filters.userName}
              onChange={(e) => handleFilterChange('userName', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Project</label>
            <input
              type="text"
              placeholder="Search by project..."
              value={filters.entityName}
              onChange={(e) => handleFilterChange('entityName', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <button className="reset-btn" onClick={handleResetFilters}>
            Reset Filters
          </button>
        </div>

        <div className="search-row">
          <input
            type="text"
            placeholder="Search across all fields..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="logs-table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>User</th>
              <th>Project</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {paginatedActivities.length === 0 ? (
              <tr>
                <td colSpan="5" className="no-data">
                  {activities.length === 0 ? (
                    <>
                      <p>No activity logs found.</p>
                      <p style={{ fontSize: '12px', marginTop: '8px' }}>
                        Click "Add Sample Data" to see how the activity log works.
                      </p>
                    </>
                  ) : (
                    'No logs match your filters.'
                  )}
                </td>
              </tr>
            ) : (
              paginatedActivities.map((log) => (
                <tr key={log.id} className="log-entry">
                  <td className="timestamp">
                    {formatTimestamp(log.timestamp)}
                  </td>
                  <td className="action">
                    <span 
                      className="action-badge"
                      style={{ backgroundColor: getActionColor(log.action) }}
                    >
                      {getActionIcon(log.action)} {log.action}
                    </span>
                  </td>
                  <td className="user">
                    <div className="user-info">
                      <span className="user-name">{log.user || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="entity">
                    <strong>{log.projectName || 'Unknown'}</strong>
                  </td>
                  <td className="details">
                    {log.details && Object.keys(log.details).length > 0 ? (
                      <div className="details-preview" title={JSON.stringify(log.details)}>
                        {JSON.stringify(log.details)}
                      </div>
                    ) : (
                      <span className="no-details">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          
          <span className="page-info">
            Page {page} of {totalPages} ({filteredActivities.length} logs)
          </span>
          
          <button 
            className="page-btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityLogPanel;