-- ============================================
-- OPTION B: Expert Analysis with History Tracking
-- - Projects table stores CURRENT values (displayed in Pipeline Details)
-- - expert_analysis_history stores ALL historical changes (audit trail)
-- Run in Supabase SQL Editor
-- ============================================

SET search_path TO pipeline_dashboard;

-- 1. Drop the old expert_analysis table if it exists (we'll recreate as history)
DROP TABLE IF EXISTS expert_analysis CASCADE;

-- 2. Create expert_analysis_history table (APPEND-ONLY audit log)
CREATE TABLE IF NOT EXISTS expert_analysis_history (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    project_name VARCHAR(255),

    -- Individual breakdown scores (for audit purposes)
    thermal_optimization_score INTEGER DEFAULT 0,
    environmental_score INTEGER DEFAULT 2,
    market_score INTEGER DEFAULT 2,
    land_availability_score INTEGER DEFAULT 2,
    utilities_score INTEGER DEFAULT 2,
    interconnection_score INTEGER DEFAULT 2,

    -- Calculated scores at time of edit
    thermal_operating_score DECIMAL(5,2) DEFAULT 0,
    redevelopment_score DECIMAL(5,2) DEFAULT 0,
    infrastructure_score DECIMAL(5,2) DEFAULT 0,
    overall_score DECIMAL(5,2) DEFAULT 0,
    overall_rating VARCHAR(50) DEFAULT 'N/A',
    confidence INTEGER DEFAULT 75,

    -- Full breakdown JSONB for complete audit trail
    thermal_breakdown JSONB DEFAULT '{}',
    redevelopment_breakdown JSONB DEFAULT '{}',

    -- Audit info
    edited_by VARCHAR(100) NOT NULL,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edit_reason TEXT,

    -- What changed (for quick filtering)
    changes_summary TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups by project
CREATE INDEX IF NOT EXISTS idx_expert_history_project_id ON expert_analysis_history(project_id);
CREATE INDEX IF NOT EXISTS idx_expert_history_edited_at ON expert_analysis_history(edited_at DESC);
CREATE INDEX IF NOT EXISTS idx_expert_history_edited_by ON expert_analysis_history(edited_by);

-- 3. Add ONLY the columns that don't already exist in projects table
-- These are for storing calculated values and edit tracking
-- NOTE: We use EXISTING columns for display in Pipeline Details:
--   - thermal_optimization (VARCHAR) - already exists
--   - environmental_score (VARCHAR) - already exists
--   - market_score (VARCHAR) - already exists
--   - infra (VARCHAR) - already exists, will store infrastructure score
--   - ix (VARCHAR) - already exists, will store interconnection score

-- Add calculated score columns (for internal tracking)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS overall_score_calc DECIMAL(5,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS thermal_score_calc DECIMAL(5,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS redev_score_calc DECIMAL(5,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS overall_rating VARCHAR(50) DEFAULT 'N/A';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS confidence INTEGER DEFAULT 75;

-- Expert analysis edit tracking on projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expert_edited_by VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expert_edited_at TIMESTAMP;

-- 4. Create a view for easy access to current expert analysis from projects
CREATE OR REPLACE VIEW v_project_expert_analysis AS
SELECT
    p.id,
    p.project_name,
    p.project_codename,
    p.plant_owner,
    p.location,
    p.iso,
    p.legacy_nameplate_capacity_mw,
    p.tech,

    -- Existing columns used for Pipeline Details display
    p.thermal_optimization,
    p.environmental_score,
    p.market_score,
    p.infra,
    p.ix,

    -- Calculated scores
    p.thermal_score_calc,
    p.redev_score_calc,
    p.overall_score_calc,
    p.overall_rating,
    p.confidence,

    -- Edit tracking
    p.expert_edited_by AS edited_by,
    p.expert_edited_at AS edited_at,
    p.updated_at

FROM projects p
WHERE p.is_active = true;

-- 5. Function to get edit history for a project
CREATE OR REPLACE FUNCTION get_project_edit_history(p_project_id INTEGER)
RETURNS TABLE (
    edit_id INTEGER,
    edited_by VARCHAR(100),
    edited_at TIMESTAMP,
    overall_score DECIMAL(5,2),
    thermal_score DECIMAL(5,2),
    redevelopment_score DECIMAL(5,2),
    infrastructure_score DECIMAL(5,2),
    changes_summary TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id,
        h.edited_by,
        h.edited_at,
        h.overall_score,
        h.thermal_operating_score,
        h.redevelopment_score,
        h.infrastructure_score,
        h.changes_summary
    FROM expert_analysis_history h
    WHERE h.project_id = p_project_id
    ORDER BY h.edited_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. Verify setup
SELECT 'Expert Analysis Option B setup complete!' as status;
SELECT 'Tables created/modified:' as info;
SELECT tablename FROM pg_tables WHERE schemaname = 'pipeline_dashboard' AND tablename IN ('expert_analysis_history', 'projects');

SELECT 'New columns added to projects:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'pipeline_dashboard'
  AND table_name = 'projects'
  AND column_name IN (
    'overall_score_calc',
    'thermal_score_calc',
    'redev_score_calc',
    'overall_rating',
    'confidence',
    'expert_edited_by',
    'expert_edited_at'
  )
ORDER BY column_name;

SELECT 'Existing columns used for Pipeline Details:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'pipeline_dashboard'
  AND table_name = 'projects'
  AND column_name IN (
    'thermal_optimization',
    'environmental_score',
    'market_score',
    'infra',
    'ix'
  )
ORDER BY column_name;
