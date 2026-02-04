// This file contains data processing utilities
// For now, it's empty as all functions are in calculations.js
// Can be expanded in the future

export const processExcelData = (rawData) => {
  // Process Excel data utility function
  const headers = rawData[0] || [];
  const cleanHeaders = headers.map((header, index) => {
    if (!header || header.toString().trim() === "") {
      return `Column_${index + 1}`;
    }
    return header.toString().trim();
  });
  
  const dataRows = rawData.slice(1);
  const processedData = [];
  
  dataRows.forEach((row, rowIndex) => {
    const obj = {};
    let hasData = false;
    
    cleanHeaders.forEach((header, colIndex) => {
      const value = row[colIndex] || "";
      obj[header] = value;
      
      if (value && value.toString().trim() !== "") {
        hasData = true;
      }
    });
    
    if (hasData) {
      processedData.push(obj);
    }
  });
  
  return { processedData, cleanHeaders };
};