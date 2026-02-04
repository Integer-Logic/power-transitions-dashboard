import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import './UploadModal.css';

const UploadModal = ({ 
  showUploadModal, 
  setShowUploadModal, 
  allData,
  setAllData,
  calculateAllData,
  setKpiRow1,
  setKpiRow2,
  setIsoData,
  setTechData,
  setRedevelopmentTypes,
  setCounterparties,
  setPipelineRows
}) => {
  const [uploadStep, setUploadStep] = useState('select'); // 'select', 'preview'
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedData, setUploadedData] = useState([]);
  const [uploadedHeaders, setUploadedHeaders] = useState([]);
  const [importOption, setImportOption] = useState('replace');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setUploadedFile(file);
    setUploadError('');
    
    // Read the Excel file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          defval: '',
          raw: false
        });
        
        if (jsonData.length === 0) {
          setUploadError('The Excel file appears to be empty.');
          return;
        }
        
        const headers = Object.keys(jsonData[0] || {});
        setUploadedHeaders(headers);
        setUploadedData(jsonData);
        setUploadStep('preview');
        
      } catch (error) {
        console.error('Error reading Excel file:', error);
        setUploadError(`Error reading file: ${error.message}`);
      }
    };
    
    reader.readAsArrayBuffer(file);
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1
  });
  
  const handleImport = () => {
    if (uploadedData.length === 0) {
      setUploadError('No data to import.');
      return;
    }
    
    setUploading(true);
    
    try {
      let finalData = [];
      
      switch(importOption) {
        case 'replace':
          // Replace all data with uploaded data
          finalData = uploadedData;
          break;
          
        case 'append':
          // Append uploaded data to existing data
          finalData = [...allData, ...uploadedData];
          break;
          
        case 'update':
          // Update existing projects, add new ones
          const existingMap = new Map();
          
          // Create a map of existing projects by name/codename
          allData.forEach(row => {
            const key = row['Project Name'] || row['Project Codename'] || '';
            if (key) existingMap.set(key.toLowerCase().trim(), row);
          });
          
          // Process uploaded data
          uploadedData.forEach(newRow => {
            const key = (newRow['Project Name'] || newRow['Project Codename'] || '').toLowerCase().trim();
            
            if (key && existingMap.has(key)) {
              // Update existing project (merge data)
              existingMap.set(key, { ...existingMap.get(key), ...newRow });
            } else {
              // Add new project
              finalData.push(newRow);
            }
          });
          
          // Add all existing projects (including updated ones)
          finalData = [...Array.from(existingMap.values()), ...finalData];
          break;
      }
      
      // Update the main data state
      setAllData(finalData);
      
      // Recalculate all metrics
      const headers = Object.keys(finalData[0] || {});
      calculateAllData(finalData, headers, {
        setKpiRow1,
        setKpiRow2,
        setIsoData,
        setTechData,
        setRedevelopmentTypes,
        setCounterparties,
        setPipelineRows
      });
      
      alert(`✅ Successfully imported ${uploadedData.length} project(s)!`);
      setShowUploadModal(false);
      resetUpload();
      
    } catch (error) {
      console.error('Error during import:', error);
      setUploadError(`❌ Import failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  const resetUpload = () => {
    setUploadStep('select');
    setUploadedFile(null);
    setUploadedData([]);
    setUploadedHeaders([]);
    setUploadError('');
  };
  
  const closeModal = () => {
    setShowUploadModal(false);
    resetUpload();
  };
  
  if (!showUploadModal) return null;
  
  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📤 Upload Excel File</h2>
          <button className="close-btn" onClick={closeModal}>×</button>
        </div>
        
        <div className="modal-body">
          {uploadStep === 'select' && (
            <div className="upload-step">
              <div 
                {...getRootProps()} 
                className={`dropzone ${isDragActive ? 'active' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="dropzone-content">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <h3>Drop Excel file here</h3>
                  <p>or click to browse (.xlsx, .xls, .csv)</p>
                  <p className="file-requirements">
                    File should contain project data with columns like Project Name, ISO, Tech, etc.
                  </p>
                </div>
              </div>
              
              <div className="template-help">
                <p>📋 Don't have the right format?</p>
                <button 
                  className="template-btn"
                  onClick={() => {
                    // This would trigger template download
                    alert('First use the Export button to download a template!');
                  }}
                >
                  Download Template First
                </button>
              </div>
            </div>
          )}
          
          {uploadStep === 'preview' && (
            <div className="upload-step">
              <div className="file-info">
                <span className="file-name">📄 {uploadedFile?.name}</span>
                <span className="file-stats">
                  📊 {uploadedData.length} rows, {uploadedHeaders.length} columns
                </span>
              </div>
              
              <div className="preview-section">
                <h4>👀 Data Preview (first 3 rows)</h4>
                <div className="preview-table-container">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {uploadedHeaders.slice(0, 8).map(header => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedData.slice(0, 3).map((row, idx) => (
                        <tr key={idx}>
                          {uploadedHeaders.slice(0, 8).map(header => (
                            <td key={header} title={String(row[header] || '')}>
                              {String(row[header] || '').substring(0, 20)}
                              {String(row[header] || '').length > 20 ? '...' : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {uploadedHeaders.length > 8 && (
                  <p className="preview-note">
                    Showing first 8 of {uploadedHeaders.length} columns
                  </p>
                )}
              </div>
              
              <div className="import-options">
                <h4>⚙️ Import Options</h4>
                <div className="options-grid">
                  <label className="option-radio">
                    <input
                      type="radio"
                      name="importOption"
                      value="replace"
                      checked={importOption === 'replace'}
                      onChange={(e) => setImportOption(e.target.value)}
                    />
                    <span>🔄 Replace all data</span>
                    <small>Replace current projects with uploaded file</small>
                  </label>
                  
                  <label className="option-radio">
                    <input
                      type="radio"
                      name="importOption"
                      value="append"
                      checked={importOption === 'append'}
                      onChange={(e) => setImportOption(e.target.value)}
                    />
                    <span>➕ Append to existing</span>
                    <small>Add new projects, keep existing ones</small>
                  </label>
                  
                  <label className="option-radio">
                    <input
                      type="radio"
                      name="importOption"
                      value="update"
                      checked={importOption === 'update'}
                      onChange={(e) => setImportOption(e.target.value)}
                    />
                    <span>🔄 Update existing</span>
                    <small>Update matching projects, add new ones</small>
                  </label>
                </div>
              </div>
            </div>
          )}
          
          {uploadError && (
            <div className="error-message">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {uploadError}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          {uploadStep === 'select' && (
            <>
              <button className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              <div style={{flex: 1}}></div>
            </>
          )}
          
          {uploadStep === 'preview' && (
            <>
              <button className="btn-secondary" onClick={() => setUploadStep('select')}>
                ← Back
              </button>
              <div style={{flex: 1}}></div>
              <button 
                className="btn-secondary" 
                onClick={resetUpload}
                disabled={uploading}
              >
                Upload New
              </button>
              <button 
                className="btn-primary" 
                onClick={handleImport}
                disabled={uploading}
              >
                {uploading ? '⏳ Importing...' : '✅ Import Data'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadModal;