// Import script for Supabase
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const XLSX = require('xlsx');
const path = require('path');
const database = require('../utils/db');
const { calculateAllScores } = require('../utils/scoreCalculations');

async function importToSupabase() {
  const pool = database.getPool();
  let client;

  try {
    console.log('🚀 IMPORT TO SUPABASE STARTING...');
    console.log('='.repeat(60));

    client = await pool.connect();

    // Set schema
    await client.query('SET search_path TO pipeline_dashboard');

    // Read Excel file
    const filePath = path.join(__dirname, '../../public/pt_cleanedrecords.xlsx');
    console.log(`📁 Reading: ${filePath}`);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let data = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true });

    // Fix: Trim column names (some Excel columns have trailing spaces)
    data = data.map(row => {
      const cleanRow = {};
      Object.keys(row).forEach(key => {
        cleanRow[key.trim()] = row[key];
      });
      return cleanRow;
    });

    console.log(`📊 Found ${data.length} records in Excel`);

    // Clear existing data
    console.log('\n🗑️ Clearing existing project data...');
    await client.query('TRUNCATE TABLE projects RESTART IDENTITY CASCADE');

    const insertSQL = `
      INSERT INTO projects (
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
        redev_score,
        is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44, $45, $46, $47, $48, $49, $50, $51
      ) RETURNING id;
    `;

    console.log('\n📥 Starting import...');

    let successCount = 0;
    let errorCount = 0;

    for (const [index, row] of data.entries()) {
      try {
        const extractNumericValue = (val) => {
          if (val == null || val === '' || val === 'N/A' || val === '#N/A' || val === '#VALUE!') {
            return null;
          }
          if (typeof val === 'number') return val;
          const str = String(val).trim();
          if (str.includes('XLOOKUP') || str.includes('xlfn') || str.startsWith('=')) {
            return null;
          }
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

        // Thermal optimization must be minimum 1
        const toThermalOptimization = (val) => {
          const str = toString(val);
          if (str === null) return '1'; // Default to 1
          const num = parseInt(str);
          if (isNaN(num) || num < 1) return '1'; // Minimum is 1
          return String(num);
        };

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

        // Calculate scores from component values using the canonical formula
        const calculatedScores = calculateAllScores({
          plant_cod: row['Plant  COD'],
          markets: row['Markets'],
          transactability_scores: row['Transactability Scores'],
          thermal_optimization: row['Thermal Optimization'],
          environmental_score: row['Envionmental Score'],
          market_score: row['Market Score'],
          infra: row['Infra'],
          ix: row['IX'],
          co_locate_repower: row['Co-Locate/Repower']
        });

        const values = [
          index + 1,
          toString(row['Plant Owner']),
          toString(row['Project Codename']),
          toString(row['Project Name']),
          toString(row['Overall Project Score']),  // Keep original for reference
          toString(row['Thermal Operating Score']), // Keep original for reference
          toString(row['Redevelopment Score']),     // Keep original for reference
          toString(row['Redevelopment (Load) Score']),
          toString(row['I&C Score']),
          toString(row['Process (P) or Bilateral (B)']),
          toInt(row['Number of Sites']),
          toString(row['Legacy Nameplate Capacity (MW)']),
          toString(row['Tech']),
          toString(row['Heat Rate (Btu/kWh)']),
          toString(row['2024 Capacity Factor']),
          toString(row['Legacy COD']),
          toString(row['Gas Reference']),
          toString(row['Redev Tier']),
          toString(row['Redevelopment Base Case']),
          toString(row['Redev Capacity (MW)']),
          toString(row['Redev Tech']),
          toString(row['Redev Fuel']),
          toString(row['Redev Heatrate (Btu/kWh)']),
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
          toThermalOptimization(row['Thermal Optimization']),
          toString(row['Envionmental Score']),
          toString(row['Market Score']),
          toString(row['Infra']),
          toString(row['IX']),
          toString(row['Co-Locate/Repower']),
          toString(row['Transactability Scores']),
          toString(row['Transactability']),
          toString(row['Project Type']),
          calculateStatus(row['Legacy COD'], row['Redev COD']),
          calculatedScores.overall_score.toString(),      // Use calculated overall score
          calculatedScores.thermal_score.toString(),      // Use calculated thermal score
          calculatedScores.redevelopment_score.toString(), // Use calculated redev score
          true // is_active
        ];

        await client.query(insertSQL, values);
        successCount++;

        if (successCount % 10 === 0) {
          console.log(`   ✅ Imported ${successCount} records...`);
        }

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Row ${index + 1}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Successfully imported: ${successCount} records`);
    console.log(`❌ Errors: ${errorCount} records`);

    // Verify
    const count = await client.query('SELECT COUNT(*) as total FROM projects WHERE is_active = true');
    console.log(`\n🔍 Verification: ${count.rows[0].total} active projects in database`);

    // Sample data
    const sample = await client.query('SELECT project_name, plant_owner, iso, status FROM projects LIMIT 5');
    console.log('\n📋 Sample projects:');
    sample.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.project_name} | ${row.plant_owner} | ${row.iso} | ${row.status}`);
    });

    console.log('\n🎉 IMPORT SUCCESSFUL!');

  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error.message);
    console.error(error.stack);
  } finally {
    if (client) client.release();
    process.exit(0);
  }
}

importToSupabase();
