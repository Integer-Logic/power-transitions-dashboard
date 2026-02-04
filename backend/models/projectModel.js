const database = require('../utils/db');
const pool = database.getPool();

// ========== PROJECT DATA OPERATIONS ==========

const getAllProjects = async (filters = {}) => {
  const {
    iso,
    process_type,
    plant_owner,
    status,
    tech,
    project_type,
    ma_tier,
    limit = 1000,
    offset = 0,
    sort_by = 'project_name',
    sort_order = 'ASC'
  } = filters;

  try {
    // Use schema from environment or default to pipeline_dashboard
    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    
    let query = `
      SELECT 
        p.id,
        p.excel_row_id,
        p.plant_owner,
        p.project_codename,
        p.project_name,
        p.overall_project_score,
        p.thermal_operating_score,
        p.redevelopment_score,
        p.redevelopment_load_score,
        p.ic_score,
        p.process_type,
        p.number_of_sites,
        p.legacy_nameplate_capacity_mw,
        p.tech,
        p.heat_rate_btu_kwh,
        p.capacity_factor_2024,
        p.legacy_cod,
        p.gas_reference,
        p.redev_tier,
        p.redevelopment_base_case,
        p.redev_capacity_mw,
        p.redev_tech,
        p.redev_fuel,
        p.redev_heatrate_btu_kwh,
        p.redev_cod,
        p.redev_land_control,
        p.redev_stage_gate,
        p.redev_lead,
        p.redev_support,
        p.contact,
        p.iso,
        p.zone_submarket,
        p.location,
        p.site_acreage,
        p.fuel,
        p.plant_cod,
        p.capacity_factor,
        p.markets,
        p.thermal_optimization,
        p.environmental_score,
        p.market_score,
        p.infra,
        p.ix,
        p.co_locate_repower,
        p.transactability_scores,
        p.transactability,
        p.project_type,
        p.status,
        p.ma_tier,
        p.ma_tier_id,
        p.overall_score,
        p.thermal_score,
        p.redev_score,
        p.mw,
        p.hr,
        p.cf,
        p.mkt,
        p.zone,
        p.poi_voltage_kv,
        p.created_at,
        p.updated_at,
        p.created_by,
        p.updated_by,
        p.is_active,
        mt.tier_name as ma_tier_name,
        mt.color_hex as ma_tier_color
      FROM ${schema}.projects p
      LEFT JOIN ${schema}.ma_tiers mt ON p.ma_tier_id = mt.id
      WHERE p.is_active = true
    `;
    
    const values = [];
    let paramCount = 1;

    if (iso && iso !== 'All') {
      query += ` AND p.iso = $${paramCount}`;
      values.push(iso);
      paramCount++;
    }

    if (process_type && process_type !== 'All') {
      query += ` AND p.process_type = $${paramCount}`;
      values.push(process_type === 'Process' ? 'P' : 'B');
      paramCount++;
    }

    if (plant_owner && plant_owner !== 'All') {
      query += ` AND p.plant_owner = $${paramCount}`;
      values.push(plant_owner);
      paramCount++;
    }

    if (status && status !== 'All') {
      query += ` AND p.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (tech && tech !== 'All') {
      query += ` AND (p.tech ILIKE $${paramCount} OR p.redev_tech ILIKE $${paramCount})`;
      values.push(`%${tech}%`);
      paramCount++;
    }

    if (project_type && project_type !== 'All') {
      query += ` AND p.project_type ILIKE $${paramCount}`;
      values.push(`%${project_type}%`);
      paramCount++;
    }

    if (ma_tier && ma_tier !== 'All') {
      query += ` AND p.ma_tier = $${paramCount}`;
      values.push(ma_tier);
      paramCount++;
    }

    const validSortColumns = [
      'id', 'project_name', 'project_codename', 'plant_owner', 'iso', 
      'overall_score', 'thermal_score', 'redev_score', 'mw', 'hr', 'cf', 
      'status', 'ma_tier', 'redev_tier', 'redev_stage_gate', 'transactability',
      'created_at', 'updated_at', 'poi_voltage_kv'
    ];
    
    const safeSortBy = validSortColumns.includes(sort_by.toLowerCase()) 
      ? sort_by 
      : 'project_name';
    
    const safeSortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    query += ` ORDER BY p.${safeSortBy} ${safeSortOrder}`;
    
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    values.push(parseInt(limit), parseInt(offset));

    console.log('📊 Executing query with params:', { query: query.substring(0, 200) + '...', values });
    
    const result = await pool.query(query, values);
    console.log(`✅ Retrieved ${result.rows.length} projects`);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error in getAllProjects:', error);
    throw new Error(`Database query failed: ${error.message}`);
  }
};

const getProjectById = async (id) => {
  try {
    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    
    const query = `
      SELECT 
        p.*,
        mt.tier_name as ma_tier_name,
        mt.color_hex as ma_tier_color
      FROM ${schema}.projects p
      LEFT JOIN ${schema}.ma_tiers mt ON p.ma_tier_id = mt.id
      WHERE p.id = $1 AND p.is_active = true
      LIMIT 1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error in getProjectById:', error);
    throw new Error(`Failed to fetch project: ${error.message}`);
  }
};

const getProjectByName = async (name) => {
  try {
    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    
    const query = `
      SELECT 
        p.*,
        mt.tier_name as ma_tier_name,
        mt.color_hex as ma_tier_color
      FROM ${schema}.projects p
      LEFT JOIN ${schema}.ma_tiers mt ON p.ma_tier_id = mt.id
      WHERE (p.project_name = $1 OR p.project_codename = $1) 
      AND p.is_active = true
      LIMIT 1
    `;
    
    const result = await pool.query(query, [name]);
    return result.rows[0];
  } catch (error) {
    console.error('❌ Error in getProjectByName:', error);
    throw new Error(`Failed to fetch project by name: ${error.message}`);
  }
};

const createProject = async (projectData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('📥 Received project data:', projectData);
    
    const columns = [];
    const placeholders = [];
    const values = [];
    let paramCount = 1;

    const handleMaTier = (maTierValue) => {
      if (!maTierValue) return null;
      
      const maTierMap = {
        'Owned': 1,
        'Exclusivity': 2,
        'second round': 3,
        'first round': 4,
        'pipeline': 5,
        'passed': 6
      };
      
      return maTierMap[maTierValue] || null;
    };

    for (const [key, value] of Object.entries(projectData)) {
      if (!['id', 'mw', 'hr', 'cf', 'mkt', 'zone', 'ma_tier_id'].includes(key)) {
        if (key === 'ma_tier' || key === 'M&A Tier') {
          const maTierId = handleMaTier(value);
          if (maTierId !== null) {
            columns.push('ma_tier_id');
            placeholders.push(`$${paramCount}`);
            values.push(maTierId);
            paramCount++;
          }
          columns.push('ma_tier');
          placeholders.push(`$${paramCount}`);
          values.push(value);
          paramCount++;
        } 
        else if (key === 'poi_voltage_kv' || key === 'POI Voltage (KV)') {
          columns.push('poi_voltage_kv');
          placeholders.push(`$${paramCount}`);
          
          if (value === '' || value === null || value === undefined) {
            values.push(null);
          } else {
            values.push(value);
          }
          
          paramCount++;
        }
        else {
          columns.push(key);
          placeholders.push(`$${paramCount}`);
          
          if (value === '' || value === null || value === undefined) {
            values.push(null);
          } else {
            values.push(value);
          }
          
          paramCount++;
        }
      }
    }

    columns.push('created_at', 'updated_at', 'created_by', 'updated_by', 'is_active');
    placeholders.push('NOW()', 'NOW()', '$' + paramCount, '$' + (paramCount + 1), '$' + (paramCount + 2));
    values.push('system', 'system', true);
    paramCount += 3;

    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    const query = `
      INSERT INTO ${schema}.projects (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    console.log('📝 SQL Query:', query);
    console.log('📝 Values:', values);
    
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    console.log(`✅ Created new project: ${result.rows[0].project_name}`);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in createProject:', error);
    throw new Error(`Failed to create project: ${error.message}`);
  } finally {
    client.release();
  }
};

const updateProject = async (id, updates) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    const checkQuery = `SELECT id FROM ${schema}.projects WHERE id = $1 AND is_active = true`;
    const checkResult = await client.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      throw new Error('Project not found or inactive');
    }
    
    const setClauses = [];
    const values = [];
    let paramCount = 1;

    console.log('🔄 Updates received:', updates);
    
    const handleMaTier = (maTierValue) => {
      if (!maTierValue) return null;
      
      const maTierMap = {
        'Owned': 1,
        'Exclusivity': 2,
        'second round': 3,
        'first round': 4,
        'pipeline': 5,
        'passed': 6
      };
      
      return maTierMap[maTierValue] || null;
    };

    for (const [key, value] of Object.entries(updates)) {
      if (!['id', 'mw', 'hr', 'cf', 'mkt', 'zone'].includes(key)) {
        if (key === 'ma_tier' || key === 'M&A Tier') {
          const maTierValue = value;
          const maTierId = handleMaTier(maTierValue);
          
          setClauses.push(`ma_tier = $${paramCount}`);
          values.push(maTierValue);
          paramCount++;
          
          setClauses.push(`ma_tier_id = $${paramCount}`);
          values.push(maTierId);
          paramCount++;
        } 
        else if (key === 'status' || key === 'Status') {
          setClauses.push(`status = $${paramCount}`);
          if (value && typeof value === 'string') {
            values.push(value.charAt(0).toUpperCase() + value.slice(1).toLowerCase());
          } else {
            values.push(value);
          }
          paramCount++;
        }
        else if (key === 'poi_voltage_kv' || key === 'POI Voltage (KV)') {
          setClauses.push(`poi_voltage_kv = $${paramCount}`);
          
          if (value === '' || value === null || value === undefined) {
            values.push(null);
          } else {
            values.push(value);
          }
          
          paramCount++;
        }
        else {
          setClauses.push(`${key} = $${paramCount}`);
          
          if (value === '' || value === null || value === undefined) {
            values.push(null);
          } else {
            values.push(value);
          }
          
          paramCount++;
        }
      }
    }

    setClauses.push('updated_at = NOW()');
    setClauses.push(`updated_by = 'api'`);

    values.push(id);
    
    const query = `
      UPDATE ${schema}.projects
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('📝 Update Query:', query);
    console.log('📝 Values being sent:', values);
    
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    console.log(`✅ Updated project: ${result.rows[0].project_name}`);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in updateProject:', error);
    throw new Error(`Failed to update project: ${error.message}`);
  } finally {
    client.release();
  }
};

const deleteProject = async (id) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    const query = `
      UPDATE ${schema}.projects
      SET is_active = false, updated_at = NOW(), updated_by = 'api'
      WHERE id = $1
      RETURNING id, project_name
    `;

    const result = await client.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }
    
    await client.query('COMMIT');
    
    console.log(`🗑️ Soft deleted project: ${result.rows[0].project_name}`);
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error in deleteProject:', error);
    throw new Error(`Failed to delete project: ${error.message}`);
  } finally {
    client.release();
  }
};

const getDashboardStats = async () => {
  try {
    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    
    const queries = {
      totalProjects: {
        text: `SELECT COUNT(*) as count FROM ${schema}.projects WHERE is_active = true`,
      },
      
      isoDistribution: {
        text: `SELECT iso, COUNT(*) as count FROM ${schema}.projects WHERE is_active = true AND iso IS NOT NULL GROUP BY iso ORDER BY count DESC`,
      },
      
      techDistribution: {
        text: `SELECT tech, COUNT(*) as count FROM ${schema}.projects WHERE is_active = true AND tech IS NOT NULL GROUP BY tech ORDER BY count DESC LIMIT 10`,
      },
      
      statusDistribution: {
        text: `SELECT status, COUNT(*) as count FROM ${schema}.projects WHERE is_active = true AND status IS NOT NULL GROUP BY status ORDER BY count DESC`,
      },
      
      maTierDistribution: {
        text: `SELECT ma_tier, COUNT(*) as count FROM ${schema}.projects WHERE is_active = true AND ma_tier IS NOT NULL GROUP BY ma_tier ORDER BY 
          CASE ma_tier
            WHEN 'Owned' THEN 1
            WHEN 'Exclusivity' THEN 2
            WHEN 'second round' THEN 3
            WHEN 'first round' THEN 4
            WHEN 'pipeline' THEN 5
            WHEN 'passed' THEN 6
            ELSE 7
          END`,
      },
      
      ownerDistribution: {
        text: `SELECT plant_owner, COUNT(*) as count FROM ${schema}.projects WHERE is_active = true AND plant_owner IS NOT NULL GROUP BY plant_owner ORDER BY count DESC LIMIT 10`,
      },
      
      poiVoltageDistribution: {
        text: `SELECT poi_voltage_kv, COUNT(*) as count FROM ${schema}.projects WHERE is_active = true AND poi_voltage_kv IS NOT NULL GROUP BY poi_voltage_kv ORDER BY count DESC LIMIT 10`,
      },
      
      scoreStats: {
        text: `SELECT 
          ROUND(AVG(CAST(NULLIF(overall_score, '') AS NUMERIC))::numeric, 2) as avg_overall,
          ROUND(AVG(CAST(NULLIF(thermal_score, '') AS NUMERIC))::numeric, 2) as avg_thermal,
          ROUND(AVG(CAST(NULLIF(redev_score, '') AS NUMERIC))::numeric, 2) as avg_redev,
          ROUND(SUM(CAST(NULLIF(mw, '') AS NUMERIC))::numeric, 2) as total_mw,
          ROUND(AVG(CAST(NULLIF(poi_voltage_kv, '') AS NUMERIC))::numeric, 2) as avg_poi_voltage,
          COUNT(*) as total_projects
        FROM ${schema}.projects WHERE is_active = true`,
      },
      
      redevDistribution: {
        text: `SELECT 
          redev_tech,
          COUNT(*) as count,
          ROUND(SUM(CAST(NULLIF(redev_capacity_mw, '') AS NUMERIC))::numeric, 2) as total_capacity
        FROM ${schema}.projects 
        WHERE is_active = true AND redev_tech IS NOT NULL
        GROUP BY redev_tech 
        ORDER BY count DESC
        LIMIT 10`,
      }
    };

    const results = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await pool.query(query.text);
        results[key] = result.rows;
      } catch (error) {
        console.error(`❌ Error in getDashboardStats for ${key}:`, error.message);
        results[key] = [];
      }
    }
    
    console.log('📊 Dashboard statistics retrieved successfully');
    return results;
  } catch (error) {
    console.error('❌ Error in getDashboardStats:', error);
    throw new Error(`Failed to fetch dashboard statistics: ${error.message}`);
  }
};

const getFilterOptions = async () => {
  try {
    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    
    const queries = {
      isos: {
        text: `SELECT DISTINCT iso as value FROM ${schema}.projects WHERE is_active = true AND iso IS NOT NULL AND iso != '' ORDER BY iso`,
      },
      
      owners: {
        text: `SELECT DISTINCT plant_owner as value FROM ${schema}.projects WHERE is_active = true AND plant_owner IS NOT NULL AND plant_owner != '' ORDER BY plant_owner`,
      },
      
      techs: {
        text: `SELECT DISTINCT tech as value FROM ${schema}.projects WHERE is_active = true AND tech IS NOT NULL AND tech != '' ORDER BY tech`,
      },
      
      statuses: {
        text: `SELECT DISTINCT status as value FROM ${schema}.projects WHERE is_active = true AND status IS NOT NULL AND status != '' ORDER BY status`,
      },
      
      maTiers: {
        text: `SELECT DISTINCT ma_tier as value FROM ${schema}.projects WHERE is_active = true AND ma_tier IS NOT NULL AND ma_tier != '' ORDER BY 
          CASE ma_tier
            WHEN 'Owned' THEN 1
            WHEN 'Exclusivity' THEN 2
            WHEN 'second round' THEN 3
            WHEN 'first round' THEN 4
            WHEN 'pipeline' THEN 5
            WHEN 'passed' THEN 6
            ELSE 7
          END`,
      },
      
      projectTypes: {
        text: `SELECT DISTINCT project_type as value FROM ${schema}.projects WHERE is_active = true AND project_type IS NOT NULL AND project_type != '' ORDER BY project_type`,
      },
      
      processTypes: {
        text: `SELECT DISTINCT process_type as value FROM ${schema}.projects WHERE is_active = true AND process_type IS NOT NULL AND process_type != '' ORDER BY process_type`,
      },
      
      poiVoltages: {
        text: `SELECT DISTINCT poi_voltage_kv as value FROM ${schema}.projects WHERE is_active = true AND poi_voltage_kv IS NOT NULL AND poi_voltage_kv != '' ORDER BY CAST(poi_voltage_kv AS NUMERIC)`,
      },
      
      maTierOptions: {
        text: `SELECT tier_name as value, color_hex FROM ${schema}.ma_tiers WHERE is_active = true ORDER BY tier_order`,
      },
      
      redevFuelOptions: {
        text: `SELECT DISTINCT fuel_name as value FROM ${schema}.redev_fuels WHERE is_active = true ORDER BY fuel_name`,
      },
      
      redevelopmentBaseOptions: {
        text: `SELECT DISTINCT base_case_name as value FROM ${schema}.redev_base_cases WHERE is_active = true ORDER BY base_case_name`,
      },
      
      redevLeadOptions: {
        text: `SELECT DISTINCT lead_name as value FROM ${schema}.redev_lead_options WHERE is_active = true ORDER BY lead_name`,
      },
      
      redevSupportOptions: {
        text: `SELECT DISTINCT support_name as value FROM ${schema}.redev_support_options WHERE is_active = true ORDER BY support_name`,
      },
      
      coLocateRepowerOptions: {
        text: `SELECT DISTINCT option_name as value FROM ${schema}.co_locate_repower_options WHERE is_active = true ORDER BY option_name`,
      }
    };

    const results = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await pool.query(query.text);
        
        if (key === 'maTierOptions') {
          results[key] = result.rows.map(row => ({
            value: row.value,
            color: row.color_hex
          }));
        } else {
          results[key] = result.rows.map(row => row.value);
        }
      } catch (error) {
        console.error(`❌ Error fetching ${key} options:`, error.message);
        
        if (key === 'maTierOptions') {
          results[key] = [
            { value: 'Owned', color: '#8b5cf6' },
            { value: 'Exclusivity', color: '#10b981' },
            { value: 'second round', color: '#3b82f6' },
            { value: 'first round', color: '#f59e0b' },
            { value: 'pipeline', color: '#6b7280' },
            { value: 'passed', color: '#ef4444' }
          ];
        } else if (key.includes('Options')) {
          results[key] = [];
        } else {
          results[key] = [];
        }
      }
    }
    
    console.log('🔍 Filter options retrieved successfully');
    return results;
  } catch (error) {
    console.error('❌ Error in getFilterOptions:', error);
    throw new Error(`Failed to fetch filter options: ${error.message}`);
  }
};

const getProjectsCount = async (filters = {}) => {
  try {
    const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';
    
    let query = `SELECT COUNT(*) as total FROM ${schema}.projects WHERE is_active = true`;
    
    const values = [];
    let paramCount = 1;

    if (filters.iso && filters.iso !== 'All') {
      query += ` AND iso = $${paramCount}`;
      values.push(filters.iso);
      paramCount++;
    }

    if (filters.plant_owner && filters.plant_owner !== 'All') {
      query += ` AND plant_owner = $${paramCount}`;
      values.push(filters.plant_owner);
      paramCount++;
    }

    if (filters.ma_tier && filters.ma_tier !== 'All') {
      query += ` AND ma_tier = $${paramCount}`;
      values.push(filters.ma_tier);
      paramCount++;
    }

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].total);
  } catch (error) {
    console.error('❌ Error in getProjectsCount:', error);
    throw new Error(`Failed to get projects count: ${error.message}`);
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  getProjectByName,
  createProject,
  updateProject,
  deleteProject,
  getDashboardStats,
  getFilterOptions,
  getProjectsCount,
  
  testConnection: database.testConnection.bind(database)
};
