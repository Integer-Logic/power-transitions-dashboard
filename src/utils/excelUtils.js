import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Generate Excel file from data
export const exportToExcel = (data, fileName = 'projects_export.xlsx') => {
  try {
    if (!data || data.length === 0) {
      console.error('No data to export');
      return false;
    }
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Convert data to worksheet
    const ws = XLSX.utils.json_to_sheet(data, {
      header: Object.keys(data[0] || {}),
      skipHeader: false
    });
    
    // Set column widths
    const maxWidths = {};
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        const value = String(row[key] || '');
        maxWidths[key] = Math.max(maxWidths[key] || 0, value.length);
      });
    });
    
    const wscols = Object.keys(maxWidths).map(key => ({
      wch: Math.min(Math.max(maxWidths[key] || 10, 10), 50)
    }));
    ws['!cols'] = wscols;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Projects');
    
    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    // Save file
    saveAs(blob, fileName);
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return false;
  }
};

// Get example value for a column
const getExampleValue = (header) => {
  const examples = {
    'Project Name': 'Roseton',
    'Project Codename': 'Cloud',
    'Plant Owner': 'CCI',
    'Overall Project Score': '5.1',
    'Thermal Operating Score': '2.4',
    'Redevelopment Score': '2.7',
    'Redevelopment (Load) Score': '',
    'I&C Score': '',
    'Process (P) or Bilateral (B)': 'P',
    'Number of Sites': '1',
    'Legacy Nameplate Capacity (MW)': '1210',
    'Tech': 'ST',
    'Heat Rate (Btu/kWh)': '11400',
    '2024 Capacity Factor': '0.022',
    'Legacy COD': '1974',
    'Fuel': 'Gas',
    'Site Acreage': '~20 developable acres',
    'ISO': 'NYISO',
    'Zone/Submarket': 'G',
    'Location': 'Newburgh, NY',
    'Markets': '',
    'Gas Reference': '',
    'Redevelopment Base Case': 'BESS',
    'Redev Tier': '',
    'Redev Capacity (MW)': '',
    'Redev Tech': '',
    'Redev Fuel': '',
    'Redev Heatrate (Btu/kWh)': '',
    'Redev COD': '',
    'Redev Land Control': '',
    'Redev Stage Gate': '',
    'Redev Lead': '',
    'Redev Support': '',
    'Contact': 'Arvind Rajpal',
    'Plant COD': '',
    'Capacity Factor': '',
    'Thermal Optimization': '',
    'Envionmental Score': '2',
    'Market Score': '3',
    'Infra': '3',
    'IX': '2',
    'Co-Locate/Repower': 'Codevelopment',
    'Transactability Scores': '2',
    'Transactability': 'Bilateral w/new relationship or Process w/less than 10 bidders',
    'Project Type': 'M&A,Redev'
  };
  return examples[header] || '';
};

// Get column description
const getColumnDescription = (header) => {
  const descriptions = {
    'Project Name': 'Name of the project (Required)',
    'Project Codename': 'Internal codename',
    'Plant Owner': 'Owner/operator company',
    'Overall Project Score': 'Overall score 0-5',
    'Thermal Operating Score': 'Thermal operating score 0-5',
    'Redevelopment Score': 'Redevelopment score 0-5',
    'Process (P) or Bilateral (B)': 'P for Process, B for Bilateral',
    'Legacy Nameplate Capacity (MW)': 'Capacity in megawatts (number)',
    'Tech': 'ST, GT, CCGT, Hydro, Wind, Solar, BESS, Other',
    'ISO': 'PJM, NYISO, ISONE, MISO, ERCOT, CAISO, SPP, Other',
    'Fuel': 'Gas, Oil, Coal, Nuclear, etc.',
    'Location': 'City, State',
    '2024 Capacity Factor': 'Decimal between 0-1',
    'Project Type': 'M&A,Redev or Redev,Owned or Redev or M&A',
    'Transmission Data': 'Format: "voltage|injection|withdrawal|constraints|hasExcess;..."',
    'Thermal Optimization': '0, 1, or 2 - thermal optimization potential (0=yet to be saved, 1=no value add, 2=readily apparent value add)'
  };
  return descriptions[header] || 'Data column';
};

// Generate template with all columns
export const generateTemplate = (headers, fileName = 'project_template.xlsx') => {
  try {
    const wb = XLSX.utils.book_new();
    
    // Create sample data with headers and example rows
    const sampleData = [
      // Header row (will be auto-added by json_to_sheet)
      headers.reduce((obj, header) => {
        obj[header] = getExampleValue(header);
        return obj;
      }, {})
    ];
    
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    
    // Add column descriptions as second row
    const descriptionRow = headers.reduce((obj, header) => {
      obj[header] = getColumnDescription(header);
      return obj;
    }, {});
    
    XLSX.utils.sheet_add_json(ws, [descriptionRow], { 
      skipHeader: true, 
      origin: 'A2' 
    });
    
    // Add note row
    const noteRow = headers.reduce((obj, header) => {
      if (header === 'Project Name') {
        obj[header] = 'NOTE: Replace example data with your own projects';
      }
      return obj;
    }, {});
    
    XLSX.utils.sheet_add_json(ws, [noteRow], { 
      skipHeader: true, 
      origin: 'A3' 
    });
    
    // Set column widths
    const wscols = headers.map(header => ({
      wch: Math.min(Math.max(header.length, 10), 30)
    }));
    ws['!cols'] = wscols;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, fileName);
    return true;
  } catch (error) {
    console.error('Error generating template:', error);
    return false;
  }
};