import React, { useState, useEffect } from 'react';

const AdminPanel = ({ showAdminPanel, setShowAdminPanel }) => {
  const [edits, setEdits] = useState({});
  const [pendingExcelUpdates, setPendingExcelUpdates] = useState([]);
  
  useEffect(() => {
    loadEdits();
  }, [showAdminPanel]);
  
  const loadEdits = () => {
    try {
      const allEdits = JSON.parse(localStorage.getItem('projectEdits') || '{}');
      const pending = JSON.parse(localStorage.getItem('pendingExcelUpdates') || '[]');
      setEdits(allEdits);
      setPendingExcelUpdates(pending);
    } catch (error) {
      console.error('Error loading edits:', error);
    }
  };
  
  const clearEdit = (projectId) => {
    if (window.confirm('Remove all edits for this project?')) {
      const allEdits = JSON.parse(localStorage.getItem('projectEdits') || '{}');
      delete allEdits[projectId];
      localStorage.setItem('projectEdits', JSON.stringify(allEdits));
      loadEdits();
    }
  };
  
  const clearAllEdits = () => {
    if (window.confirm('Remove ALL edits from all projects?')) {
      localStorage.removeItem('projectEdits');
      localStorage.removeItem('pendingExcelUpdates');
      loadEdits();
    }
  };
  
  const exportToExcel = () => {
    // This would trigger a real Excel export
    alert('Excel export would be generated here. In production, this would create a downloadable Excel file.');
  };
  
  if (!showAdminPanel) return null;
  
  return (
    <div className="modal-overlay" onClick={() => setShowAdminPanel(false)}>
      <div className="modal-content admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Management Panel</h2>
          <button className="modal-close" onClick={() => setShowAdminPanel(false)}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="admin-stats">
            <div className="stat-card">
              <h3>{Object.keys(edits).length}</h3>
              <p>Projects with Edits</p>
            </div>
            <div className="stat-card">
              <h3>{pendingExcelUpdates.length}</h3>
              <p>Pending Excel Updates</p>
            </div>
          </div>
          
          <div className="admin-actions">
            <button className="btn btn-secondary" onClick={exportToExcel}>
              Export All Edits to Excel
            </button>
            <button className="btn btn-danger" onClick={clearAllEdits}>
              Clear All Edits
            </button>
          </div>
          
          <div className="edits-list">
            <h3>Edited Projects</h3>
            {Object.keys(edits).length === 0 ? (
              <p className="no-edits">No edits found.</p>
            ) : (
              <table className="edits-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Edited By</th>
                    <th>Date</th>
                    <th>Overall Score</th>
                    <th>Excel Sync</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(edits).map(([projectId, edit]) => (
                    <tr key={projectId}>
                      <td>{edit.projectName || `Project ${projectId}`}</td>
                      <td>{edit.editedBy || 'Unknown'}</td>
                      <td>{new Date(edit.editedAt).toLocaleDateString()}</td>
                      <td>
                        {edit.originalScores?.overall || '?'} → {edit.overallScore}
                      </td>
                      <td>
                        {edit.saveType === 'save-excel' ? (
                          <span className="sync-pending">Pending</span>
                        ) : (
                          <span className="sync-done">App Only</span>
                        )}
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => clearEdit(projectId)}
                        >
                          Clear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowAdminPanel(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;