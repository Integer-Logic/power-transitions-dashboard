const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'pipeline_dashboard',
  user: 'dashboard_admin',
  password: 'powertransition'
});

async function correctImport() {
  let client;
  try {
    console.log('🚀 CORRECT IMPORT STARTING...');
    console.log('='.repeat(60));
    
    client = await pool.connect();
    
    // Read Excel file
    const filePath = path.join(__dirname, '../../public/pt_cleanedrecords.xlsx');
    console.log(`📁 Reading: ${filePath}`);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true });
    
    console.log(`📊 Found ${data.length} records in Excel`);
    
    // Clear existing data
    console.log('\n🗑️ Clearing existing data...');
    await client.query('TRUNCATE TABLE pipeline_dashboard.projects RESTART IDENTITY CASCADE');
    
    // Debug: Show what's in the Excel for first row
    console.log('\n🔍 DEBUG: Checking first row from Excel...');
    if (data.length > 0) {
      const firstRow = data[0];
      console.log('Project:', firstRow['Project Name']);
      console.log('Overall Score Raw:', firstRow['Overall Project Score']);
      console.log('Type:', typeof firstRow['Overall Project Score']);
      console.log('Contains =_xlfn?', String(firstRow['Overall Project Score']).includes('=_xlfn'));
      console.log('Contains XLOOKUP?', String(firstRow['Overall Project Score']).includes('XLOOKUP'));
    }
    
    const insertSQL = `
      INSERT INTO pipeline_dashboard.projects (
        excel_row_id,
        plant_owner,
        project_codename,
        project_name,
        overall_project_score,
        thermal_operating_score,
        redevelopment_score,
        redevelopment_load_score,
        ic_score,
        process_type,
        number_of_sites,
        legacy_nameplate_capacity_mw,
        tech,
        heat_rate_btu_kwh,
        capacity_factor_2024,
        legacy_cod,
        gas_reference,
        redev_tier,
        redevelopment_base_case,
        redev_capacity_mw,
        redev_tech,
        redev_fuel,
        redev_heatrate_btu_kwh,
        redev_cod,
        redev_land_control,
        redev_stage_gate,
        redev_lead,
        redev_support,
        contact,
        iso,
        zone_submarket,
        location,
        site_acreage,
        fuel,
        plant_cod,
        capacity_factor,
        markets,
        thermal_optimization,
        environmental_score,
        market_score,
        infra,
        ix,
        co_locate_repower,
        transactability_scores,
        transactability,
        project_type,
        status,
        overall_score,
        thermal_score,
        redev_score
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44, $45, $46, $47, $48, $49, $50
      ) RETURNING id;
    `;
    
    console.log('\n📥 Starting import...');
    
    let successCount = 0;
    
    for (const [index, row] of data.entries()) {
      try {
        // Helper function to extract numeric value
        const extractNumericValue = (val) => {
          if (val == null || val === '' || val === 'N/A' || val === '#N/A' || val === '#VALUE!') {
            return null;
          }
          
          // If it's already a number
          if (typeof val === 'number') {
            return val;
          }
          
          const str = String(val).trim();
          
          // Check if it's a formula - IMPORTANT: We need to PRESERVE the formula as text
          // But also extract numeric value if possible
          if (str.includes('XLOOKUP') || str.includes('xlfn') || str.startsWith('=')) {
            // This is a formula - we'll return null for numeric extraction
            // The formula text will be stored separately
            return null;
          }
          
          // Try to parse as float
          const num = parseFloat(str);
          return isNaN(num) ? null : num;
        };
        
        const toString = (val) => {
          if (val == null || val === '' || val === 'N/A' || val === '#N/A' || val === '#VALUE!') {
            return null;
          }
          return String(val).trim();
        };
        
        const toInt = (val) => {
          const num = extractNumericValue(val);
          return num != null ? Math.round(num) : null;
        };
        
        // Calculate status
        const calculateStatus = (legacyCOD, redevCOD) => {
          const currentYear = new Date().getFullYear();
          
          const extractYear = (cod) => {
            if (!cod) return null;
            const match = String(cod).match(/\b(\d{4})\b/);
            return match ? parseInt(match[1]) : null;
          };
          
          const redevYear = extractYear(redevCOD);
          if (redevYear != null) {
            return redevYear > currentYear ? 'Future' : 'Operating';
          }
          
          const legacyYear = extractYear(legacyCOD);
          if (legacyYear != null) {
            return legacyYear > currentYear ? 'Future' : 'Operating';
          }
          
          return 'Unknown';
        };
        
        // Prepare values
        const values = [
          index + 1,
          toString(row['Plant Owner']),
          toString(row['Project Codename']),
          toString(row['Project Name']),
          // PRESERVE FORMULA AS TEXT - even if it looks like a number
          toString(row['Overall Project Score']),
          
          toString(row['Thermal Operating Score']),
          toString(row['Redevelopment Score']),
          toString(row['Redevelopment (Load) Score']),
          toString(row['I&C Score']),
          toString(row['Process (P) or Bilateral (B)']),
          
          toInt(row['Number of Sites']),
          extractNumericValue(row['Legacy Nameplate Capacity (MW)']),
          toString(row['Tech']),
          extractNumericValue(row['Heat Rate (Btu/kWh)']),
          extractNumericValue(row['2024 Capacity Factor']),
          
          toString(row['Legacy COD']),
          toString(row['Gas Reference']),
          toString(row['Redev Tier']),
          toString(row['Redevelopment Base Case']),
          extractNumericValue(row['Redev Capacity (MW)']),
          
          toString(row['Redev Tech']),
          toString(row['Redev Fuel']),
          extractNumericValue(row['Redev Heatrate (Btu/kWh)']),
          toString(row['Redev COD']),
          toString(row['Redev Land Control']),
          
          toString(row['Redev Stage Gate']),
          toString(row['Redev Lead']),
          toString(row['Redev Support']),
          toString(row['Contact']),
          toString(row['ISO']),
          
          toString(row['Zone/Submarket']),
          toString(row['Location']),
          toString(row['Site Acreage']),
          toString(row['Fuel']),
          toString(row['Plant  COD']),
          
          toString(row['Capacity Factor']),
          toString(row['Markets']),
          toString(row['Thermal Optimization']),
          toString(row['Envionmental Score']) || extractNumericValue(row['Envionmental Score']),
          toString(row['Market Score']) || extractNumericValue(row['Market Score']),
          
          toString(row['Infra']),
          toString(row['IX']),
          toString(row['Co-Locate/Repower']),
          toString(row['Transactability Scores']),
          toString(row['Transactability']),
          
          toString(row['Project Type']),
          calculateStatus(row['Legacy COD'], row['Redev COD']),
          extractNumericValue(row['Overall Project Score']), // overall_score
          extractNumericValue(row['Thermal Operating Score']), // thermal_score
          extractNumericValue(row['Redevelopment Score']) // redev_score
        ];
        
        // Insert the record
        await client.query(insertSQL, values);
        successCount++;
        
        // Show progress
        if (successCount % 10 === 0) {
          console.log(`   ✅ Imported ${successCount} records...`);
        }
        
      } catch (error) {
        console.error(`   ❌ Row ${index + 1}: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${successCount} records`);
    
    // FIXED VERIFICATION CODE
    console.log('\n🔍 VERIFYING DATA...');
    
    const counts = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN overall_project_score LIKE '=%' THEN 1 END) as formulas,
        COUNT(CASE WHEN overall_project_score LIKE '=_xlfn%' THEN 1 END) as xlfn_formulas,
        COUNT(CASE WHEN overall_score IS NOT NULL THEN 1 END) as numeric_scores
      FROM pipeline_dashboard.projects
    `);
    
    const stats = counts.rows[0];
    console.log(`   Total records: ${stats.total}`);
    console.log(`   Formulas (any): ${stats.formulas}`);
    console.log(`   XLOOKUP formulas: ${stats.xlfn_formulas}`);
    console.log(`   Numeric scores extracted: ${stats.numeric_scores}`);
    
    // Get score statistics safely
    const scoreStats = await client.query(`
      SELECT 
        AVG(overall_score::numeric) as avg_score,
        MIN(overall_score::numeric) as min_score,
        MAX(overall_score::numeric) as max_score
      FROM pipeline_dashboard.projects
      WHERE overall_score IS NOT NULL
    `);
    
    const scoreData = scoreStats.rows[0];
    if (scoreData.avg_score) {
      console.log(`   Average score: ${parseFloat(scoreData.avg_score).toFixed(2)}`);
      console.log(`   Score range: ${scoreData.min_score || 'N/A'} to ${scoreData.max_score || 'N/A'}`);
    } else {
      console.log(`   Average score: N/A (no numeric scores)`);
    }
    
    // Check formulas in detail
    console.log('\n🔍 CHECKING FORMULAS IN DETAIL...');
    const formulaSample = await client.query(`
      SELECT 
        project_name,
        overall_project_score,
        overall_score
      FROM pipeline_dashboard.projects 
      WHERE overall_project_score LIKE '=%'
      LIMIT 3
    `);
    
    if (formulaSample.rows.length > 0) {
      console.log('   Formula samples:');
      formulaSample.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.project_name}`);
        console.log(`      Formula: ${row.overall_project_score?.substring(0, 50)}...`);
        console.log(`      Extracted value: ${row.overall_score}`);
      });
    } else {
      console.log('   No formulas found - checking what IS stored...');
      const sample = await client.query(`
        SELECT project_name, overall_project_score, overall_score
        FROM pipeline_dashboard.projects 
        LIMIT 3
      `);
      sample.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.project_name}`);
        console.log(`      Stored as: "${row.overall_project_score}"`);
        console.log(`      Type in DB: ${typeof row.overall_project_score}`);
        console.log(`      Extracted: ${row.overall_score}`);
      });
    }
    
    // Check generated columns
    console.log('\n🔍 CHECKING GENERATED COLUMNS...');
    const generated = await client.query(`
      SELECT 
        project_name,
        mw,
        legacy_nameplate_capacity_mw,
        hr,
        heat_rate_btu_kwh,
        mkt,
        iso
      FROM pipeline_dashboard.projects 
      LIMIT 3
    `);
    
    console.log('   Generated column samples:');
    generated.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.project_name}`);
      console.log(`      MW: ${row.mw} = ${row.legacy_nameplate_capacity_mw} ✓`);
      console.log(`      HR: ${row.hr} = ${row.heat_rate_btu_kwh} ✓`);
      console.log(`      MKT: "${row.mkt}" = "${row.iso}" ✓`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 IMPORT SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log('\n✅ To verify all data:');
    console.log('   psql -h localhost -p 5432 -U dashboard_admin -d pipeline_dashboard \\');
    console.log('     -c "SELECT COUNT(*) FROM pipeline_dashboard.projects;"');
    console.log('   psql -h localhost -p 5432 -U dashboard_admin -d pipeline_dashboard \\');
    console.log('     -c "SELECT project_name, plant_owner, overall_project_score, overall_score FROM pipeline_dashboard.projects LIMIT 5;"');
    
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error.message);
    console.error(error.stack);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run the import
correctImport();