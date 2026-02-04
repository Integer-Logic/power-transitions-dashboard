// import_poi_simple.js
const XLSX = require('xlsx');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function importPoiVoltage() {
    console.log('🚀 POI Voltage Import - SIMPLE VERSION');
    console.log('='.repeat(50));
    
    // 1. Load Excel file
    const excelFile = path.join(__dirname, '../..', 'KV_list.xlsx');
    console.log(`📄 Loading: ${excelFile}`);
    
    if (!fs.existsSync(excelFile)) {
        console.error('❌ Excel file not found!');
        return;
    }
    
    // 2. Read Excel - SIMPLE APPROACH
    const workbook = XLSX.readFile(excelFile);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get ALL data as array of arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`📊 Found ${rawData.length} rows in Excel`);
    
    // 3. Find the header row
    let headerRowIndex = -1;
    let projectNameCol = -1;
    let voltageCol = -1;
    
    for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const row = rawData[i];
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').toLowerCase();
            if (cell.includes('project') && cell.includes('name')) {
                headerRowIndex = i;
                projectNameCol = j;
                // Voltage column is usually next to project name
                voltageCol = j + 1;
                break;
            }
        }
        if (headerRowIndex !== -1) break;
    }
    
    if (headerRowIndex === -1) {
        console.log('⚠️  No headers found, using row 0 as headers');
        headerRowIndex = 0;
        projectNameCol = 0;
        voltageCol = 1;
    }
    
    console.log(`✅ Headers at row ${headerRowIndex + 1}`);
    console.log(`   Project Name column: ${projectNameCol + 1}`);
    console.log(`   POI Voltage column: ${voltageCol + 1}`);
    
    // 4. Extract project data
    const projects = [];
    
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length <= Math.max(projectNameCol, voltageCol)) continue;
        
        const projectName = String(row[projectNameCol] || '').trim();
        let voltageValue = row[voltageCol];
        
        if (!projectName || projectName === '') continue;
        
        // Convert voltage to number
        if (typeof voltageValue === 'string') {
            voltageValue = parseFloat(voltageValue);
        }
        
        if (isNaN(voltageValue)) {
            console.log(`⚠️  Skipping ${projectName} - Invalid voltage: ${row[voltageCol]}`);
            continue;
        }
        
        projects.push({
            name: projectName,
            voltage: voltageValue
        });
    }
    
    console.log(`\n✅ Found ${projects.length} valid projects to import`);
    console.log('\n📋 First 10 projects:');
    projects.slice(0, 10).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} -> ${p.voltage} KV`);
    });
    
    // 5. Connect to database
    console.log('\n🔗 Connecting to database...');
    const client = new Client({
        host: 'localhost',
        database: 'pipeline_dashboard',
        user: 'dashboard_admin',
        password: 'powertransition',
        port: 5432
    });
    
    try {
        await client.connect();
        console.log('✅ Database connected');
        
        // 6. Import data
        let successCount = 0;
        let failedCount = 0;
        
        console.log('\n🔄 Importing data...');
        
        for (const project of projects) {
            try {
                // First try exact match
                let result = await client.query(
                    `UPDATE pipeline_dashboard.projects 
                     SET poi_voltage_kv = $1, 
                         updated_at = NOW(),
                         updated_by = 'import'
                     WHERE LOWER(TRIM(project_name)) = LOWER($2)
                     RETURNING id, project_name`,
                    [project.voltage, project.name]
                );
                
                // If no exact match, try case-insensitive partial match
                if (result.rowCount === 0) {
                    result = await client.query(
                        `UPDATE pipeline_dashboard.projects 
                         SET poi_voltage_kv = $1, 
                             updated_at = NOW(),
                             updated_by = 'import'
                         WHERE project_name ILIKE $2
                         RETURNING id, project_name`,
                        [project.voltage, `%${project.name}%`]
                    );
                }
                
                if (result.rowCount > 0) {
                    successCount++;
                    console.log(`   ✓ ${project.name} -> ${project.voltage} KV`);
                } else {
                    failedCount++;
                    console.log(`   ✗ ${project.name} - NOT FOUND in database`);
                }
                
            } catch (error) {
                failedCount++;
                console.log(`   ✗ ${project.name} - ERROR: ${error.message}`);
            }
        }
        
        // 7. Show results
        console.log('\n' + '='.repeat(50));
        console.log('📊 IMPORT RESULTS');
        console.log('='.repeat(50));
        console.log(`✅ Successfully updated: ${successCount} projects`);
        console.log(`❌ Failed to update: ${failedCount} projects`);
        
        // 8. Verify import
        console.log('\n🔍 Verification - Projects with POI Voltage:');
        const verifyResult = await client.query(
            `SELECT project_name, poi_voltage_kv 
             FROM pipeline_dashboard.projects 
             WHERE poi_voltage_kv IS NOT NULL 
             ORDER BY poi_voltage_kv DESC 
             LIMIT 10`
        );
        
        if (verifyResult.rows.length > 0) {
            verifyResult.rows.forEach(row => {
                console.log(`   ${row.project_name}: ${row.poi_voltage_kv} KV`);
            });
        } else {
            console.log('   No projects found with POI Voltage');
        }
        
        // 9. Show statistics
        const stats = await client.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(poi_voltage_kv) as with_voltage,
                COUNT(*) - COUNT(poi_voltage_kv) as without_voltage
             FROM pipeline_dashboard.projects`
        );
        
        console.log('\n📈 Database Statistics:');
        console.log(`   Total projects: ${stats.rows[0].total}`);
        console.log(`   With POI Voltage: ${stats.rows[0].with_voltage}`);
        console.log(`   Without POI Voltage: ${stats.rows[0].without_voltage}`);
        
    } catch (error) {
        console.error(`\n❌ Database error: ${error.message}`);
    } finally {
        await client.end();
        console.log('\n🔌 Database connection closed');
    }
    
    console.log('\n✨ Import process completed!');
}

// Run the import
importPoiVoltage();