// backend/routes/dropdownOptions.js
const express = require('express');
const router = express.Router();
const database = require('../utils/db');
const pool = database.getPool();

// GET /api/dropdown-options
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching dropdown options...');
    
    // Fetch all dropdown options from database
    const [
      projectTypes,
      redevFuels,
      redevBases,
      redevLeads,
      redevSupports,
      coLocateOptions,
      plantOwners,
      technologies,
      fuelTypes,
      isoOptions
    ] = await Promise.all([
      // From lookup tables
      pool.query('SELECT id, type_name as name FROM project_types ORDER BY type_name'),
      pool.query('SELECT id, fuel_name as name FROM redev_fuels ORDER BY fuel_name'),
      pool.query('SELECT id, base_case_name as name FROM redev_base_cases ORDER BY base_case_name'),
      pool.query('SELECT id, lead_name as name FROM redev_lead_options ORDER BY lead_name'),
      pool.query('SELECT id, support_name as name FROM redev_support_options ORDER BY support_name'),
      pool.query('SELECT id, option_name as name FROM co_locate_repower_options ORDER BY option_name'),
      
      // FROM PROJECTS TABLE - CORRECT COLUMN NAMES:
      // Plant Owners - from plant_owner column (TEXT type)
      pool.query(`
        SELECT DISTINCT plant_owner as name 
        FROM projects 
        WHERE plant_owner IS NOT NULL 
        AND plant_owner != '' 
        AND plant_owner != 'Select Plant Owner'
        ORDER BY plant_owner
      `),
      
      // Technologies - from tech column (TEXT type)
      pool.query(`
        SELECT DISTINCT tech as name 
        FROM projects 
        WHERE tech IS NOT NULL 
        AND tech != '' 
        AND tech != 'Select Technology'
        ORDER BY tech
      `),
      
      // Fuel Types - from fuel column (TEXT type)
      pool.query(`
        SELECT DISTINCT fuel as name 
        FROM projects 
        WHERE fuel IS NOT NULL 
        AND fuel != '' 
        AND fuel != 'Select Fuel Type'
        ORDER BY fuel
      `),
      
      // ISO/RTO - from iso column (TEXT type)
      pool.query(`
        SELECT DISTINCT iso as name 
        FROM projects 
        WHERE iso IS NOT NULL 
        AND iso != '' 
        ORDER BY iso
      `)
    ]);

    // Debug the results
    console.log('📊 Dropdown query results:', {
      plantOwners: plantOwners.rows.length,
      technologies: technologies.rows.length,
      fuelTypes: fuelTypes.rows.length,
      isoOptions: isoOptions.rows.length,
      sampleTech: technologies.rows.slice(0, 5),
      sampleFuel: fuelTypes.rows.slice(0, 5),
      sampleISO: isoOptions.rows.slice(0, 5)
    });

    // Format the response
    const response = {
      // From lookup tables
      projectTypeOptions: projectTypes.rows,
      redevFuelOptions: redevFuels.rows,
      redevelopmentBaseOptions: redevBases.rows,
      redevLeadOptions: redevLeads.rows,
      redevSupportOptions: redevSupports.rows,
      coLocateRepowerOptions: coLocateOptions.rows,
      
      // From distinct values in projects table
      plantOwners: plantOwners.rows.map(row => row.name).filter(name => name && name.trim() !== ''),
      technologyOptions: technologies.rows.map(row => row.name).filter(name => name && name.trim() !== ''),
      fuelTypes: fuelTypes.rows.map(row => row.name).filter(name => name && name.trim() !== ''),
      isoOptions: isoOptions.rows.map(row => row.name).filter(name => name && name.trim() !== ''),
      
      // Fixed options
      processOptions: ["P", "B"],
      redevTechOptions: ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"],
      redevTierOptions: ["0", "1", "2", "3", "I", "II", "III", "IV", "V"],
      redevLandControlOptions: ["Y", "N"],
      redevStageGateOptions: ["0", "1", "2", "3", "P"]
    };

    console.log('✅ Dropdown options formatted:', {
      plantOwnersCount: response.plantOwners.length,
      technologiesCount: response.technologyOptions.length,
      fuelsCount: response.fuelTypes.length,
      isoCount: response.isoOptions.length,
      plantOwnersSample: response.plantOwners.slice(0, 5),
      techSample: response.technologyOptions.slice(0, 5)
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching dropdown options:', error);
    console.error('Stack trace:', error.stack);
    
    // Test database connection
    try {
      const testQuery = await pool.query('SELECT COUNT(*) FROM projects');
      console.log('✅ Database connection test - Projects count:', testQuery.rows[0].count);
      
      const testColumns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'pipeline_dashboard' 
        AND table_name = 'projects'
        AND column_name IN ('tech', 'fuel', 'iso', 'plant_owner')
      `);
      console.log('📋 Available columns:', testColumns.rows);
    } catch (dbError) {
      console.error('❌ Database test failed:', dbError.message);
    }
    
    // Fallback options
    const fallbackOptions = {
      projectTypeOptions: [{ id: 1, name: "Redev" }, { id: 2, name: "M&A" }, { id: 3, name: "Owned" }],
      redevFuelOptions: [{ id: 1, name: "Gas" }, { id: 2, name: "Coal" }, { id: 3, name: "Oil" }, { id: 4, name: "Nuclear" }, { id: 5, name: "Biomass" }, { id: 6, name: "Diesel" }, { id: 7, name: "N/A" }],
      redevelopmentBaseOptions: [{ id: 1, name: "BESS" }, { id: 2, name: "Gas/Thermal" }, { id: 3, name: "Solar" }, { id: 4, name: "Powered Land" }, { id: 5, name: "Dual Fuel Recips" }, { id: 6, name: "Datacenter" }, { id: 7, name: "Plant Optimization" }],
      redevLeadOptions: [{ id: 1, name: "John Doe" }, { id: 2, name: "Jane Smith" }, { id: 3, name: "Mike Johnson" }, { id: 4, name: "Sarah Williams" }],
      redevSupportOptions: [{ id: 1, name: "Engineering" }, { id: 2, name: "Finance" }, { id: 3, name: "Legal" }, { id: 4, name: "Operations" }, { id: 5, name: "Regulatory" }],
      coLocateRepowerOptions: [{ id: 1, name: "Solar Co-location" }, { id: 2, name: "BESS Co-location" }, { id: 3, name: "Full Repower" }, { id: 4, name: "Partial Repower" }, { id: 5, name: "Hybrid System" }],
      plantOwners: ["Calpine/Constellation", "Rockland", "Telen", "JERA"],
      technologyOptions: ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"],
      fuelTypes: ["Coal", "Gas", "Oil", "Nuclear", "Biomass", "Hydro", "Wind", "Solar"],
      isoOptions: ["PJM", "NYISO", "ISONE", "MISO", "ERCOT", "CAISO", "SPP", "Other"],
      processOptions: ["P", "B"],
      redevTechOptions: ["ST", "GT", "CCGT", "Hydro", "Wind", "Solar", "BESS", "Other"],
      redevTierOptions: ["0", "1", "2", "3", "I", "II", "III", "IV", "V"],
      redevLandControlOptions: ["Y", "N"],
      redevStageGateOptions: ["0", "1", "2", "3", "P"]
    };
    
    console.log('⚠️ Returning fallback dropdown options');
    res.json(fallbackOptions);
  }
});

module.exports = router;