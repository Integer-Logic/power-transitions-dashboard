const database = require('../utils/db');
const pool = database.getPool();
const { calculateThermalScore, calculateRedevelopmentScore, calculateOverallScore } = require('../utils/scoreCalculations');

class ExpertAnalysis {
  // ========== EXPERT ANALYSIS OPERATIONS (OPTION B) ==========
  // - Current values stored in PROJECTS table (existing columns)
  // - Edit history stored in expert_analysis_history table (full breakdown)
  //
  // COLUMN MAPPING (Modal → Projects table):
  //   thermal_optimization score → thermal_optimization (VARCHAR)
  //   environmental score → environmental_score (VARCHAR)
  //   market score → market_score (VARCHAR)
  //   infrastructure score (calculated) → infra (VARCHAR)
  //   interconnection score → ix (VARCHAR)

  /**
   * Get expert analysis data for a project
   * Reads directly from the PROJECTS table (current values)
   */
  static async getExpertAnalysisByProjectId(projectId) {
    try {
      const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';

      // Read current values directly from projects table
      const query = `
        SELECT
          p.id,
          p.project_name,
          p.project_codename,
          p.plant_owner,
          p.location,
          p.iso,
          p.legacy_nameplate_capacity_mw,
          p.tech,

          -- Existing columns used for Pipeline Details
          p.thermal_optimization,
          p.environmental_score,
          p.market_score,
          p.infra,
          p.ix,

          -- Calculated scores (new columns)
          COALESCE(p.thermal_score_calc, 0) as thermal_score_calc,
          COALESCE(p.redev_score_calc, 0) as redev_score_calc,
          COALESCE(p.overall_score_calc, 0) as overall_score_calc,
          COALESCE(p.overall_rating, 'N/A') as overall_rating,
          COALESCE(p.confidence, 75) as confidence,

          -- Edit tracking
          p.expert_edited_by as edited_by,
          p.expert_edited_at as edited_at,
          p.updated_at,

          -- Legacy score columns for reference
          p.overall_project_score,
          p.thermal_operating_score,
          p.redevelopment_score

        FROM ${schema}.projects p
        WHERE p.id = $1
        AND p.is_active = true
        LIMIT 1
      `;

      console.log('🔍 Fetching expert analysis for project ID:', projectId);

      const result = await pool.query(query, [projectId]);

      if (result.rows.length === 0) {
        console.log(`📭 No project found for ID ${projectId}`);
        return null;
      }

      const project = result.rows[0];

      // Parse existing column values (stored as VARCHAR, may be numeric strings)
      // Helper to parse int with default, allowing 0 values
      const parseIntOrDefault = (val, defaultVal) => {
        const parsed = parseInt(val);
        return isNaN(parsed) ? defaultVal : parsed;
      };
      const parseFloatOrDefault = (val, defaultVal) => {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? defaultVal : parsed;
      };

      const thermalOptScore = parseIntOrDefault(project.thermal_optimization, 1);  // Min is 1
      const envScore = parseIntOrDefault(project.environmental_score, 2);          // Allows 0
      const mktScore = parseIntOrDefault(project.market_score, 2);                 // Allows 0
      const infraScore = parseFloatOrDefault(project.infra, 2);                    // Allows 0
      const ixScore = parseIntOrDefault(project.ix, 2);                            // Allows 0

      // Build the response in the format the frontend expects
      const expertAnalysis = {
        projectId: project.id,
        projectName: project.project_name,
        projectCodename: project.project_codename,

        // Calculated scores
        overallScore: parseFloat(project.overall_score_calc) || 0,
        thermalScore: parseFloat(project.thermal_score_calc) || 0,
        redevelopmentScore: parseFloat(project.redev_score_calc) || 0,
        infrastructureScore: infraScore,
        overallRating: project.overall_rating || 'N/A',
        confidence: parseInt(project.confidence) || 75,

        // Breakdown objects (format expected by frontend)
        // NOTE: land_availability and utilities are estimated from infra score
        // since we don't store them separately in projects table
        thermalBreakdown: {
          thermal_optimization: { score: thermalOptScore },
          environmental: { score: envScore }
        },
        redevelopmentBreakdown: {
          redev_market: { score: mktScore },
          land_availability: { score: Math.round(infraScore) }, // Estimated from infra
          utilities: { score: Math.round(infraScore) }, // Estimated from infra
          interconnection: { score: ixScore }
        },

        // Edit tracking
        editedBy: project.edited_by,
        editedAt: project.edited_at,

        // Additional project info
        plantOwner: project.plant_owner,
        location: project.location,
        iso: project.iso,
        legacyNameplateCapacityMw: project.legacy_nameplate_capacity_mw,
        tech: project.tech
      };

      console.log(`✅ Found expert analysis for project ID ${projectId}`);
      return expertAnalysis;
    } catch (error) {
      console.error('❌ Error in getExpertAnalysisByProjectId:', error);
      throw new Error(`Failed to fetch expert analysis: ${error.message}`);
    }
  }

  /**
   * Save expert analysis data
   * OPTION B Implementation:
   * 1. UPDATE projects table with current values (existing columns)
   * 2. INSERT history record into expert_analysis_history (full breakdown)
   */
  static async saveExpertAnalysis(analysisData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      console.log('📥 Received expert analysis data:', {
        projectId: analysisData.projectId,
        projectName: analysisData.projectName?.substring(0, 50),
        overallScore: analysisData.overallScore,
        editedBy: analysisData.editedBy
      });

      const {
        projectId,
        projectName,
        overallScore,
        overallRating,
        confidence,
        thermalScore,
        thermalBreakdown,
        redevelopmentScore,
        redevelopmentBreakdown,
        infrastructureScore,
        editedBy = 'PowerTrans Team'
      } = analysisData;

      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';

      // Extract individual scores from breakdowns
      const thermalOptimizationScore = thermalBreakdown?.thermal_optimization?.score ?? 1;
      const environmentalScoreValue = thermalBreakdown?.environmental?.score ?? 2;
      const marketScoreValue = redevelopmentBreakdown?.redev_market?.score ?? 2;
      const landAvailabilityScore = redevelopmentBreakdown?.land_availability?.score ?? 2;
      const utilitiesScore = redevelopmentBreakdown?.utilities?.score ?? 2;
      const interconnectionScore = redevelopmentBreakdown?.interconnection?.score ?? 2;

      // Calculate infrastructure score (average of land + utilities)
      const calculatedInfraScore = ((landAvailabilityScore + utilitiesScore) / 2).toFixed(2);

      // Fetch additional component values from the database for score recalculation
      const componentQuery = `
        SELECT plant_cod, markets, transactability_scores, co_locate_repower
        FROM ${schema}.projects
        WHERE id = $1
      `;
      const componentResult = await client.query(componentQuery, [projectId]);
      const projectComponents = componentResult.rows[0] || {};

      // Recalculate scores using canonical functions to ensure consistency
      const recalculatedThermal = calculateThermalScore({
        plant_cod: projectComponents.plant_cod,
        markets: projectComponents.markets,
        transactability_scores: projectComponents.transactability_scores,
        thermal_optimization: thermalOptimizationScore,
        environmental_score: environmentalScoreValue
      });

      const recalculatedRedev = calculateRedevelopmentScore({
        market_score: marketScoreValue,
        infra: parseFloat(calculatedInfraScore),
        ix: interconnectionScore,
        co_locate_repower: projectComponents.co_locate_repower
      });

      const recalculatedOverall = calculateOverallScore(recalculatedThermal, recalculatedRedev);

      // Use recalculated scores (these should match what frontend sent, but ensures server-side consistency)
      const finalThermalScore = recalculatedThermal;
      const finalRedevScore = recalculatedRedev;
      const finalOverallScore = recalculatedOverall;
      const finalOverallRating = finalOverallScore >= 4.5 ? 'Strong' : finalOverallScore >= 3.0 ? 'Moderate' : 'Weak';

      console.log('🔢 Recalculated scores:', {
        thermal: finalThermalScore,
        redev: finalRedevScore,
        overall: finalOverallScore,
        rating: finalOverallRating
      });

      // Step 1: Get current values from projects table (for history comparison)
      const currentQuery = `
        SELECT
          thermal_optimization,
          environmental_score,
          market_score,
          infra,
          ix,
          thermal_score_calc,
          redev_score_calc,
          overall_score_calc,
          overall_rating,
          confidence
        FROM ${schema}.projects
        WHERE id = $1
      `;
      const currentResult = await client.query(currentQuery, [projectId]);
      const currentValues = currentResult.rows[0] || {};

      // Step 2: UPDATE projects table with new values (EXISTING columns)
      const updateQuery = `
        UPDATE ${schema}.projects
        SET
          -- Update EXISTING columns (these show in Pipeline Details)
          thermal_optimization = $1,
          environmental_score = $2,
          market_score = $3,
          infra = $4,
          ix = $5,

          -- Update calculated score columns (new columns)
          thermal_score_calc = $6,
          redev_score_calc = $7,
          overall_score_calc = $8,
          overall_rating = $9,
          confidence = $10,

          -- Edit tracking
          expert_edited_by = $11,
          expert_edited_at = NOW(),
          updated_by = $11,
          updated_at = NOW()
        WHERE id = $12
        RETURNING *
      `;

      const updateValues = [
        thermalOptimizationScore.toString(),      // thermal_optimization (VARCHAR)
        environmentalScoreValue.toString(),       // environmental_score (VARCHAR)
        marketScoreValue.toString(),              // market_score (VARCHAR)
        calculatedInfraScore,                     // infra (VARCHAR) - calculated from land+utilities
        interconnectionScore.toString(),          // ix (VARCHAR)
        finalThermalScore,                        // thermal_score_calc (DECIMAL) - recalculated
        finalRedevScore,                          // redev_score_calc (DECIMAL) - recalculated
        finalOverallScore,                        // overall_score_calc (DECIMAL) - recalculated
        finalOverallRating,                       // overall_rating (VARCHAR) - recalculated
        parseInt(confidence) || 75,               // confidence (INTEGER)
        editedBy,                                 // expert_edited_by
        projectId                                 // WHERE id = ?
      ];

      console.log('🔄 Updating projects table with values:', {
        thermal_optimization: thermalOptimizationScore,
        environmental_score: environmentalScoreValue,
        market_score: marketScoreValue,
        infra: calculatedInfraScore,
        ix: interconnectionScore,
        thermal_score_calc: finalThermalScore,
        redev_score_calc: finalRedevScore,
        overall_score_calc: finalOverallScore
      });

      const updateResult = await client.query(updateQuery, updateValues);

      if (updateResult.rowCount === 0) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      console.log(`✅ Updated projects table for project ID ${projectId}`);

      // Step 3: Build changes summary
      const changes = [];
      if (currentValues.thermal_optimization != thermalOptimizationScore) {
        changes.push(`thermal_opt: ${currentValues.thermal_optimization} → ${thermalOptimizationScore}`);
      }
      if (currentValues.environmental_score != environmentalScoreValue) {
        changes.push(`environmental: ${currentValues.environmental_score} → ${environmentalScoreValue}`);
      }
      if (currentValues.market_score != marketScoreValue) {
        changes.push(`market: ${currentValues.market_score} → ${marketScoreValue}`);
      }
      if (currentValues.infra != calculatedInfraScore) {
        changes.push(`infra: ${currentValues.infra} → ${calculatedInfraScore}`);
      }
      if (currentValues.ix != interconnectionScore) {
        changes.push(`ix: ${currentValues.ix} → ${interconnectionScore}`);
      }

      const changesSummary = changes.length > 0 ? changes.join(', ') : 'No changes';

      // Step 4: INSERT history record (append-only audit log with FULL breakdown)
      const historyQuery = `
        INSERT INTO ${schema}.expert_analysis_history (
          project_id,
          project_name,
          thermal_optimization_score,
          environmental_score,
          market_score,
          land_availability_score,
          utilities_score,
          interconnection_score,
          thermal_operating_score,
          redevelopment_score,
          infrastructure_score,
          overall_score,
          overall_rating,
          confidence,
          thermal_breakdown,
          redevelopment_breakdown,
          edited_by,
          edited_at,
          changes_summary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), $18)
        RETURNING id
      `;

      const historyValues = [
        projectId,
        projectName || `Project ${projectId}`,
        thermalOptimizationScore,
        environmentalScoreValue,
        marketScoreValue,
        landAvailabilityScore,       // Full breakdown stored in history
        utilitiesScore,              // Full breakdown stored in history
        interconnectionScore,
        finalThermalScore,           // Use recalculated score
        finalRedevScore,             // Use recalculated score
        parseFloat(calculatedInfraScore) || 0,
        finalOverallScore,           // Use recalculated score
        finalOverallRating,          // Use recalculated rating
        parseInt(confidence) || 75,
        JSON.stringify(thermalBreakdown || {}),
        JSON.stringify(redevelopmentBreakdown || {}),
        editedBy,
        changesSummary
      ];

      const historyResult = await client.query(historyQuery, historyValues);
      console.log(`📜 Created history record ID ${historyResult.rows[0].id} for project ${projectId}`);

      await client.query('COMMIT');

      // Return the saved data in the format the frontend expects
      const savedAnalysis = {
        projectId: projectId,
        projectName: projectName,
        overallScore: finalOverallScore,          // Use recalculated score
        thermalScore: finalThermalScore,          // Use recalculated score
        redevelopmentScore: finalRedevScore,       // Use recalculated score
        infrastructureScore: parseFloat(calculatedInfraScore) || 0,
        overallRating: finalOverallRating,        // Use recalculated rating
        confidence: parseInt(confidence) || 75,
        thermalBreakdown: thermalBreakdown,
        redevelopmentBreakdown: redevelopmentBreakdown,
        editedBy: editedBy,
        editedAt: new Date().toISOString(),
        historyId: historyResult.rows[0].id
      };

      console.log(`✅ Expert analysis saved for project ${projectId} (history ID: ${savedAnalysis.historyId})`);

      return savedAnalysis;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error in saveExpertAnalysis:', error);
      throw new Error(`Failed to save expert analysis: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get edit history for a project
   * Returns the full breakdown from history table
   */
  static async getEditHistory(projectId, limit = 10) {
    try {
      const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';

      const query = `
        SELECT
          id,
          project_id,
          project_name,
          thermal_optimization_score,
          environmental_score,
          market_score,
          land_availability_score,
          utilities_score,
          interconnection_score,
          overall_score,
          overall_rating,
          thermal_operating_score,
          redevelopment_score,
          infrastructure_score,
          edited_by,
          edited_at,
          changes_summary
        FROM ${schema}.expert_analysis_history
        WHERE project_id = $1
        ORDER BY edited_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [projectId, limit]);

      console.log(`📜 Found ${result.rows.length} history records for project ${projectId}`);
      return result.rows;
    } catch (error) {
      console.error('❌ Error in getEditHistory:', error);
      throw new Error(`Failed to fetch edit history: ${error.message}`);
    }
  }

  /**
   * Get a specific history entry with full details (including JSONB breakdowns)
   */
  static async getHistoryEntry(historyId) {
    try {
      const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';

      const query = `
        SELECT *
        FROM ${schema}.expert_analysis_history
        WHERE id = $1
      `;

      const result = await pool.query(query, [historyId]);

      if (result.rows.length === 0) {
        return null;
      }

      const entry = result.rows[0];

      // Parse JSONB fields
      if (entry.thermal_breakdown && typeof entry.thermal_breakdown === 'string') {
        entry.thermal_breakdown = JSON.parse(entry.thermal_breakdown);
      }
      if (entry.redevelopment_breakdown && typeof entry.redevelopment_breakdown === 'string') {
        entry.redevelopment_breakdown = JSON.parse(entry.redevelopment_breakdown);
      }

      return entry;
    } catch (error) {
      console.error('❌ Error in getHistoryEntry:', error);
      throw new Error(`Failed to fetch history entry: ${error.message}`);
    }
  }

  // ========== TRANSMISSION INTERCONNECTION OPERATIONS ==========

  static async getTransmissionInterconnectionByProject(projectName) {
    try {
      const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';

      const query = `
        SELECT
          ti.*,
          p.project_name as actual_project_name,
          p.project_codename,
          p.iso,
          p.plant_owner
        FROM ${schema}.transmission_interconnection ti
        LEFT JOIN ${schema}.projects p ON ti.site = p.project_name
        WHERE (ti.site ILIKE $1 OR p.project_name ILIKE $1 OR p.project_codename ILIKE $1)
        AND p.is_active = true
        ORDER BY ti.created_at DESC
      `;

      console.log('🔍 Fetching transmission data for project:', projectName);

      const result = await pool.query(query, [`%${projectName}%`]);

      if (result.rows.length === 0) {
        console.log(`📭 No transmission data found for project ${projectName}`);
        return [];
      }

      console.log(`✅ Found ${result.rows.length} transmission records for project ${projectName}`);
      return result.rows;
    } catch (error) {
      console.error('❌ Error in getTransmissionInterconnectionByProject:', error);
      throw new Error(`Failed to fetch transmission data: ${error.message}`);
    }
  }

  static async getTransmissionInterconnectionByProjectId(projectId) {
    try {
      const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';

      const query = `
        SELECT ti.*, p.project_name as actual_project_name
        FROM ${schema}.transmission_interconnection ti
        LEFT JOIN ${schema}.projects p ON ti.project_id = p.id::varchar
        WHERE ti.project_id = $1
        AND p.is_active = true
        ORDER BY ti.created_at DESC
      `;

      const result = await pool.query(query, [projectId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error in getTransmissionInterconnectionByProjectId:', error);
      throw new Error(`Failed to fetch transmission data: ${error.message}`);
    }
  }

  static async saveTransmissionInterconnection(projectId, transmissionData) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      console.log('📥 Saving transmission data for project ID:', projectId);
      console.log('📥 Transmission data count:', transmissionData?.length || 0);

      if (!projectId || !Array.isArray(transmissionData)) {
        throw new Error('Project ID and transmission data array are required');
      }

      const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';

      // First, get the project details
      const projectQuery = `
        SELECT project_name, project_codename FROM ${schema}.projects
        WHERE id = $1 AND is_active = true
        LIMIT 1
      `;

      const projectResult = await client.query(projectQuery, [projectId]);

      if (projectResult.rows.length === 0) {
        throw new Error(`Project with ID ${projectId} not found or inactive`);
      }

      const projectName = projectResult.rows[0].project_name;
      const projectCodename = projectResult.rows[0].project_codename;

      console.log(`📋 Found project: ${projectName} (${projectCodename})`);

      // Insert new transmission data
      if (transmissionData.length > 0) {
        const insertPromises = transmissionData.map(async (item) => {
          const insertQuery = `
            INSERT INTO ${schema}.transmission_interconnection (
              site,
              poi_voltage,
              excess_injection_capacity,
              excess_withdrawal_capacity,
              constraints,
              excess_ix_capacity,
              project_id,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            ON CONFLICT (site, poi_voltage, project_id)
            DO UPDATE SET
              excess_injection_capacity = EXCLUDED.excess_injection_capacity,
              excess_withdrawal_capacity = EXCLUDED.excess_withdrawal_capacity,
              constraints = EXCLUDED.constraints,
              excess_ix_capacity = EXCLUDED.excess_ix_capacity,
              updated_at = NOW()
            RETURNING *
          `;

          const values = [
            item.site || projectName,
            item.poiVoltage || '',
            parseFloat(item.excessInjectionCapacity) || 0,
            parseFloat(item.excessWithdrawalCapacity) || 0,
            item.constraints || '-',
            item.excessIXCapacity !== undefined ? item.excessIXCapacity : true,
            projectId
          ];

          console.log('📝 Inserting transmission record:', {
            site: values[0],
            poiVoltage: values[1],
            injection: values[2],
            withdrawal: values[3]
          });

          return client.query(insertQuery, values);
        });

        const results = await Promise.all(insertPromises);
        const savedData = results.map(result => result.rows[0]);

        console.log(`✅ Saved/updated ${savedData.length} transmission records for project ID ${projectId}`);

        await client.query('COMMIT');

        return savedData;
      } else {
        // No data to insert
        console.log(`📭 No transmission data to save for project ID ${projectId}`);
        await client.query('COMMIT');
        return [];
      }
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error in saveTransmissionInterconnection:', error);
      throw new Error(`Failed to save transmission data: ${error.message}`);
    } finally {
      client.release();
    }
  }

  static async checkExpertAnalysisExists(projectName) {
    try {
      const schema = process.env.DB_SCHEMA || 'pipeline_dashboard';

      // Check if project has expert analysis data (non-null expert_edited_at)
      const query = `
        SELECT EXISTS(
          SELECT 1 FROM ${schema}.projects p
          WHERE (p.project_name ILIKE $1 OR p.project_codename ILIKE $1)
          AND p.is_active = true
          AND p.expert_edited_at IS NOT NULL
        ) as exists
      `;

      const result = await pool.query(query, [`%${projectName}%`]);
      return result.rows[0].exists;
    } catch (error) {
      console.error('❌ Error in checkExpertAnalysisExists:', error);
      return false;
    }
  }
}

module.exports = ExpertAnalysis;
