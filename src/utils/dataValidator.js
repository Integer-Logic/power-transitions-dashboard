export const validateProjectData = (data) => {
  const errors = [];
  const warnings = [];
  
  data.forEach((row, index) => {
    // Required fields
    if (!row['Project Name'] && !row['Project Codename']) {
      errors.push(`Row ${index + 2}: Missing Project Name or Codename`);
    }
    
    // Numeric validation
    const capacity = parseFloat(row['Legacy Nameplate Capacity (MW)']);
    if (capacity && (isNaN(capacity) || capacity < 0)) {
      errors.push(`Row ${index + 2}: Invalid capacity value`);
    }
    
    // ISO validation
    const validISOs = ['PJM', 'NYISO', 'ISONE', 'MISO', 'ERCOT', 'CAISO', 'SPP', 'Other'];
    if (row['ISO'] && !validISOs.includes(row['ISO'])) {
      warnings.push(`Row ${index + 2}: Unusual ISO value "${row['ISO']}"`);
    }
    
    // Score validation
    const score = parseFloat(row['Overall Project Score']);
    if (score && (score < 0 || score > 5)) {
      warnings.push(`Row ${index + 2}: Score ${score} outside typical range 0-5`);
    }
  });
  
  return { errors, warnings };
};