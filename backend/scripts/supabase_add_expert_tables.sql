-- ============================================
-- ADD EXPERT ANALYSIS & TRANSMISSION TABLES
-- Run in Supabase SQL Editor
-- ============================================

SET search_path TO pipeline_dashboard;

-- 1. Expert Analysis Table
CREATE TABLE IF NOT EXISTS expert_analysis (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    project_name VARCHAR(255),
    overall_score DECIMAL(5,2) DEFAULT 0,
    overall_rating VARCHAR(50) DEFAULT 'N/A',
    confidence INTEGER DEFAULT 0,
    thermal_score DECIMAL(5,2) DEFAULT 0,
    thermal_breakdown JSONB DEFAULT '{}',
    redevelopment_score DECIMAL(5,2) DEFAULT 0,
    redevelopment_breakdown JSONB DEFAULT '{}',
    infrastructure_score DECIMAL(5,2) DEFAULT 0,
    edited_by VARCHAR(100) DEFAULT 'PowerTrans Team',
    edited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_expert_analysis_project_id ON expert_analysis(project_id);
CREATE INDEX IF NOT EXISTS idx_expert_analysis_project_name ON expert_analysis(project_name);

-- 2. Transmission Interconnection Table
CREATE TABLE IF NOT EXISTS transmission_interconnection (
    id SERIAL PRIMARY KEY,
    site VARCHAR(255),
    poi_voltage VARCHAR(50),
    excess_injection_capacity DECIMAL(10,2) DEFAULT 0,
    excess_withdrawal_capacity DECIMAL(10,2) DEFAULT 0,
    constraints TEXT DEFAULT '-',
    excess_ix_capacity BOOLEAN DEFAULT TRUE,
    project_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(site, poi_voltage, project_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transmission_site ON transmission_interconnection(site);
CREATE INDEX IF NOT EXISTS idx_transmission_project_id ON transmission_interconnection(project_id);

-- 3. Update trigger for expert_analysis
CREATE TRIGGER update_expert_analysis_timestamp
    BEFORE UPDATE ON expert_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Update trigger for transmission_interconnection
CREATE TRIGGER update_transmission_timestamp
    BEFORE UPDATE ON transmission_interconnection
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify
SELECT 'Tables created:' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'pipeline_dashboard' AND tablename IN ('expert_analysis', 'transmission_interconnection');
