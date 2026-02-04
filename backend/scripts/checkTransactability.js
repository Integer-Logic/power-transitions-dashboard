/**
 * Check Transactability data in Excel and import mapping
 */

const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../../public', 'pt_cleanedrecords.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

// Find all column names
const allKeys = new Set();
data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));

console.log('=== All columns containing "transact" (case-insensitive) ===');
const transactKeys = Array.from(allKeys).filter(k => k.toLowerCase().includes('transact'));
transactKeys.forEach(k => console.log('  -', k));

if (transactKeys.length === 0) {
  console.log('  (none found)');
}

console.log('\n=== All Excel column names ===');
Array.from(allKeys).sort().forEach(k => console.log('  -', k));

console.log('\n=== Sample data from first 5 rows ===');
data.slice(0, 5).forEach((row, i) => {
  console.log('\nRow', i + 1, ':', row['Project Name'] || row['project_name'] || 'Unknown');
  transactKeys.forEach(k => {
    console.log('  ', k, ':', row[k]);
  });
  // Also show any column that might be related
  Object.keys(row).forEach(k => {
    if (k.toLowerCase().includes('score') || k.toLowerCase().includes('mkt')) {
      console.log('  ', k, ':', row[k]);
    }
  });
});
