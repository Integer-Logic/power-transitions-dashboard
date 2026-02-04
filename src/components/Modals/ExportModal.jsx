import React, { useState } from 'react';
import './ExportModal.css';
import { exportToExcel, generateTemplate } from '../../utils/excelUtils';

const ExportModal = ({ 
  showExportModal, 
  setShowExportModal, 
  allData, 
  pipelineRows,
  currentFilters 
}) => {
  const [exportOption, setExportOption] = useState('currentView');
  const [includeFormulas, setIncludeFormulas] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  if (!showExportModal) return null;
  
  const handleExport = () => {
    setExportLoading(true);
    
    let dataToExport = [];
    let fileName = '';
    
    switch(exportOption) {
      case 'currentView':
        dataToExport = pipelineRows.map(row => {
          // Convert pipeline row back to Excel format
          const excelRow = allData.find(r => 
            r['Project Name'] === row.asset || 
            r['Project Codename'] === row.asset
          ) || row.detailData || row;
          return excelRow;
        });
        fileName = `projects_filtered_${new Date().toISOString().split('T')[0]}.xlsx`;
        break;
        
      case 'fullDatabase':
        dataToExport = allData;
        fileName = `projects_full_${new Date().toISOString().split('T')[0]}.xlsx`;
        break;
        
      case 'template':
        const headers = Object.keys(allData[0] || {});
        generateTemplate(headers, `project_template_${new Date().toISOString().split('T')[0]}.xlsx`);
        setExportLoading(false);
        setShowExportModal(false);
        return;
    }
    
    // Filter out any empty rows
    dataToExport = dataToExport.filter(row => 
      row && (row['Project Name'] || row['Project Codename'])
    );
    
    const success = exportToExcel(dataToExport, fileName);
    
    setExportLoading(false);
    if (success) {
      alert(`Exported ${dataToExport.length} projects successfully!`);
      setShowExportModal(false);
    } else {
      alert('Error exporting data. Please try again.');
    }
  };
  
  const getFilterSummary = () => {
    const activeFilters = [];
    if (currentFilters.selectedIso !== 'All') activeFilters.push(`ISO: ${currentFilters.selectedIso}`);
    if (currentFilters.selectedProcess !== 'All') activeFilters.push(`Process: ${currentFilters.selectedProcess}`);
    if (currentFilters.selectedOwner !== 'All') activeFilters.push(`Owner: ${currentFilters.selectedOwner}`);
    if (currentFilters.selectedProjectType !== 'All') activeFilters.push(`Type: ${currentFilters.selectedProjectType}`);
    if (currentFilters.selectedTransmissionVoltage !== 'All') activeFilters.push(`Voltage: ${currentFilters.selectedTransmissionVoltage}`);
    if (currentFilters.selectedHasExcessCapacity !== 'All') activeFilters.push(`Excess: ${currentFilters.selectedHasExcessCapacity}`);
    
    return activeFilters.length > 0 ? activeFilters.join(', ') : 'No filters applied';
  };
  
  return (
    <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Projects</h2>
          <button className="close-btn" onClick={() => setShowExportModal(false)}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="export-options">
            <div className="option-group">
              <label className="option-label">
                <input
                  type="radio"
                  name="exportOption"
                  value="currentView"
                  checked={exportOption === 'currentView'}
                  onChange={(e) => setExportOption(e.target.value)}
                />
                <div className="option-content">
                  <span className="option-title">Current View</span>
                  <span className="option-description">
                    Export filtered and sorted projects as shown
                  </span>
                  <div className="filter-summary">
                    <strong>{pipelineRows.length} projects</strong>
                    <span className="filter-details">{getFilterSummary()}</span>
                  </div>
                </div>
              </label>
            </div>
            
            <div className="option-group">
              <label className="option-label">
                <input
                  type="radio"
                  name="exportOption"
                  value="fullDatabase"
                  checked={exportOption === 'fullDatabase'}
                  onChange={(e) => setExportOption(e.target.value)}
                />
                <div className="option-content">
                  <span className="option-title">Full Database</span>
                  <span className="option-description">
                    Export all projects with all columns
                  </span>
                  <div className="filter-summary">
                    <strong>{allData.length} projects</strong>
                    <span className="filter-details">All data columns</span>
                  </div>
                </div>
              </label>
            </div>
            
            <div className="option-group">
              <label className="option-label">
                <input
                  type="radio"
                  name="exportOption"
                  value="template"
                  checked={exportOption === 'template'}
                  onChange={(e) => setExportOption(e.target.value)}
                />
                <div className="option-content">
                  <span className="option-title">Download Template</span>
                  <span className="option-description">
                    Get Excel template with column structure and examples
                  </span>
                  <div className="filter-summary">
                    <strong>Template file</strong>
                    <span className="filter-details">With data validation and examples</span>
                  </div>
                </div>
              </label>
            </div>
          </div>
          
          <div className="advanced-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeFormulas}
                onChange={(e) => setIncludeFormulas(e.target.checked)}
                disabled
              />
              <span>Include Excel formulas (if available)</span>
            </label>
            <p className="option-note">
              Note: Formula support coming in future update
            </p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn-secondary" 
            onClick={() => setShowExportModal(false)}
            disabled={exportLoading}
          >
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleExport}
            disabled={exportLoading}
          >
            {exportLoading ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;