-- ============================================
-- SUPABASE MIGRATION FIX
-- Run this to add missing tables and columns
-- ============================================

SET search_path TO pipeline_dashboard;

-- 1. Create ma_tiers table
CREATE TABLE IF NOT EXISTS ma_tiers (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(50) UNIQUE NOT NULL,
    tier_order INTEGER DEFAULT 0,
    color_hex VARCHAR(7) DEFAULT '#6b7280',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default MA tiers
INSERT INTO ma_tiers (tier_name, tier_order, color_hex) VALUES
('Owned', 1, '#8b5cf6'),
('Exclusivity', 2, '#10b981'),
('second round', 3, '#3b82f6'),
('first round', 4, '#f59e0b'),
('pipeline', 5, '#6b7280'),
('passed', 6, '#ef4444')
ON CONFLICT (tier_name) DO NOTHING;

-- 2. Add is_active to lookup tables
ALTER TABLE redev_fuels ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE redev_base_cases ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE redev_lead_options ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE redev_support_options ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE co_locate_repower_options ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 3. Drop the old projects table and recreate with correct schema
DROP TABLE IF EXISTS project_type_mappings;
DROP TABLE IF EXISTS redev_base_case_mappings;
DROP TABLE IF EXISTS redev_fuel_mappings;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS scores;
DROP TABLE IF EXISTS redevelopment_details;
DROP TABLE IF EXISTS market_details;
DROP TABLE IF EXISTS technical_details;
DROP TABLE IF EXISTS projects CASCADE;

-- 4. Create projects table with ALL required columns
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    excel_row_id INTEGER,

    -- Basic Info
    project_name VARCHAR(255),
    project_codename VARCHAR(100),
    plant_owner VARCHAR(255),
    location VARCHAR(255),
    site_acreage VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Unknown',
    project_type VARCHAR(100),

    -- Scores
    overall_project_score VARCHAR(50),
    thermal_operating_score VARCHAR(50),
    redevelopment_score VARCHAR(50),
    redevelopment_load_score VARCHAR(50),
    ic_score VARCHAR(50),
    overall_score VARCHAR(50),
    thermal_score VARCHAR(50),
    redev_score VARCHAR(50),
    environmental_score VARCHAR(50),
    market_score VARCHAR(50),

    -- Technical
    process_type VARCHAR(10),
    number_of_sites INTEGER,
    legacy_nameplate_capacity_mw VARCHAR(50),
    tech VARCHAR(100),
    heat_rate_btu_kwh VARCHAR(50),
    capacity_factor_2024 VARCHAR(50),
    legacy_cod VARCHAR(50),
    fuel VARCHAR(100),
    plant_cod VARCHAR(50),
    capacity_factor VARCHAR(50),

    -- Short aliases
    mw VARCHAR(50),
    hr VARCHAR(50),
    cf VARCHAR(50),
    mkt VARCHAR(50),
    zone VARCHAR(100),

    -- Market
    iso VARCHAR(50),
    zone_submarket VARCHAR(100),
    gas_reference VARCHAR(255),
    markets VARCHAR(255),
    transactability_scores VARCHAR(50),
    transactability VARCHAR(50),
    infra VARCHAR(100),
    ix VARCHAR(100),

    -- Redevelopment
    redev_tier VARCHAR(50),
    redevelopment_base_case VARCHAR(255),
    redev_capacity_mw VARCHAR(50),
    redev_tech VARCHAR(100),
    redev_fuel VARCHAR(100),
    redev_heatrate_btu_kwh VARCHAR(50),
    redev_cod VARCHAR(50),
    redev_land_control VARCHAR(10),
    redev_stage_gate VARCHAR(50),
    redev_lead VARCHAR(255),
    redev_support VARCHAR(255),
    co_locate_repower VARCHAR(255),

    -- M&A
    ma_tier VARCHAR(50),
    ma_tier_id INTEGER REFERENCES ma_tiers(id),

    -- Transmission/POI
    poi_voltage_kv VARCHAR(50),

    -- Thermal
    thermal_optimization VARCHAR(255),

    -- Contact
    contact TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system',
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(plant_owner);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_iso ON projects(iso);
CREATE INDEX IF NOT EXISTS idx_projects_ma_tier ON projects(ma_tier);
CREATE INDEX IF NOT EXISTS idx_projects_ma_tier_id ON projects(ma_tier_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);

-- 6. Recreate update trigger
DROP TRIGGER IF EXISTS update_projects_timestamp ON projects;
CREATE TRIGGER update_projects_timestamp
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Verify
SELECT 'Migration complete! Tables:' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'pipeline_dashboard' ORDER BY tablename;
