-- Pipeline Dashboard Database Setup
SET client_encoding = 'UTF8';

-- 1. Ensure schema exists
CREATE SCHEMA IF NOT EXISTS pipeline_dashboard;
SET search_path TO pipeline_dashboard;

-- 2. Projects Table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    excel_row_id INTEGER,
    project_name VARCHAR(255) NOT NULL,
    project_codename VARCHAR(100),
    plant_owner VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    site_acreage VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system',
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_project_name UNIQUE(project_name)
);

-- 3. Technical Details
CREATE TABLE technical_details (
    id SERIAL PRIMARY KEY,
    project_id INTEGER UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    legacy_capacity_mw DECIMAL(10,2),
    technology VARCHAR(50),
    heat_rate_btu_kwh DECIMAL(10,2),
    capacity_factor_percent DECIMAL(5,2),
    legacy_cod VARCHAR(4),
    fuel_type VARCHAR(50),
    number_of_sites INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Market Details
CREATE TABLE market_details (
    id SERIAL PRIMARY KEY,
    project_id INTEGER UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    iso_rto VARCHAR(50),
    zone_submarket VARCHAR(100),
    markets VARCHAR(255),
    process_type VARCHAR(1),
    gas_reference VARCHAR(255),
    transactability_score INTEGER CHECK (transactability_score BETWEEN 1 AND 4),
    transactability_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Redevelopment Details
CREATE TABLE redevelopment_details (
    id SERIAL PRIMARY KEY,
    project_id INTEGER UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    redev_tier VARCHAR(10),
    redev_capacity_mw DECIMAL(10,2),
    redev_tech VARCHAR(50),
    redev_heatrate_btu_kwh DECIMAL(10,2),
    redev_cod VARCHAR(50),
    redev_land_control VARCHAR(1),
    redev_stage_gate VARCHAR(10),
    redev_lead VARCHAR(100),
    redev_support VARCHAR(255),
    co_locate_repower VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Scores
CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    project_id INTEGER UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    overall_score DECIMAL(5,2),
    thermal_operating_score DECIMAL(5,2),
    redevelopment_score DECIMAL(5,2),
    redev_load_score DECIMAL(5,2),
    ic_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Lookup Tables
CREATE TABLE project_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    color_code VARCHAR(7)
);

CREATE TABLE redev_base_cases (
    id SERIAL PRIMARY KEY,
    base_case_name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE redev_fuels (
    id SERIAL PRIMARY KEY,
    fuel_name VARCHAR(50) UNIQUE NOT NULL
);

-- 8. Mapping Tables
CREATE TABLE project_type_mappings (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    project_type_id INTEGER REFERENCES project_types(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, project_type_id)
);

CREATE TABLE redev_base_case_mappings (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    base_case_id INTEGER REFERENCES redev_base_cases(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, base_case_id)
);

CREATE TABLE redev_fuel_mappings (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    fuel_id INTEGER REFERENCES redev_fuels(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, fuel_id)
);

-- 9. Contacts
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    contact_name VARCHAR(255),
    contact_details TEXT,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Audit Log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(100) DEFAULT 'system',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Indexes
CREATE INDEX idx_projects_name ON projects(project_name);
CREATE INDEX idx_projects_owner ON projects(plant_owner);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_technical_project_id ON technical_details(project_id);
CREATE INDEX idx_market_project_id ON market_details(project_id);
CREATE INDEX idx_redev_project_id ON redevelopment_details(project_id);
CREATE INDEX idx_scores_project_id ON scores(project_id);
CREATE INDEX idx_audit_changed_at ON audit_log(changed_at);

-- 12. Insert Default Data
INSERT INTO project_types (type_name, color_code) VALUES 
('Redev', '#10b981'),
('M&A', '#f59e0b'),
('Owned', '#8b5cf6');

INSERT INTO redev_fuels (fuel_name) VALUES 
('Gas'),
('Coal'),
('Oil'),
('Nuclear'),
('Biomass'),
('Diesel'),
('N/A');

INSERT INTO redev_base_cases (base_case_name) VALUES 
('BESS'),
('Gas/Thermal'),
('Solar'),
('Powered Land'),
('Dual Fuel Recips'),
('Datacenter'),
('Plant Optimization');

-- 13. Update Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 14. Audit Log Function
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), current_user);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 15. Apply Triggers
CREATE TRIGGER update_projects_timestamp BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technical_timestamp BEFORE UPDATE ON technical_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_timestamp BEFORE UPDATE ON market_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_redev_timestamp BEFORE UPDATE ON redevelopment_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit triggers
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_technical AFTER INSERT OR UPDATE OR DELETE ON technical_details
FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_market AFTER INSERT OR UPDATE OR DELETE ON market_details
FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_redevelopment AFTER INSERT OR UPDATE OR DELETE ON redevelopment_details
FOR EACH ROW EXECUTE FUNCTION log_changes();

-- 16. Test data
INSERT INTO projects (project_name, plant_owner, location, status) VALUES
('Test Project 1', 'Test Owner 1', 'New York, NY', 'Operating'),
('Test Project 2', 'Test Owner 2', 'Chicago, IL', 'Future'),
('Test Project 3', 'Test Owner 3', 'Houston, TX', 'Operating');

-- 17. Success message
SELECT '==========================================' as message;
SELECT 'DATABASE SETUP COMPLETED SUCCESSFULLY!' as message;
SELECT '==========================================' as message;
SELECT 'Tables created:' as info;
SELECT schemaname || '.' || tablename as table_name
FROM pg_tables 
WHERE schemaname = 'pipeline_dashboard'
ORDER BY tablename;

-- Create missing tables for dropdowns
CREATE TABLE pipeline_dashboard.redev_lead_options (
    id SERIAL PRIMARY KEY,
    lead_name VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pipeline_dashboard.redev_support_options (
    id SERIAL PRIMARY KEY,
    support_name VARCHAR(100) UNIQUE NOT NULL,
    team VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pipeline_dashboard.co_locate_repower_options (
    id SERIAL PRIMARY KEY,
    option_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO pipeline_dashboard.redev_lead_options (lead_name, department) VALUES 
('John Doe', 'Development'),
('Jane Smith', 'Engineering'),
('Mike Johnson', 'Project Management'),
('Sarah Williams', 'Business Development');

INSERT INTO pipeline_dashboard.redev_support_options (support_name, team) VALUES 
('Engineering', 'Technical'),
('Finance', 'Financial'),
('Legal', 'Compliance'),
('Operations', 'Execution'),
('Regulatory', 'Permitting');

INSERT INTO pipeline_dashboard.co_locate_repower_options (option_name, description) VALUES 
('Solar Co-location', 'Adding solar to existing site'),
('BESS Co-location', 'Adding battery storage'),
('Full Repower', 'Complete equipment replacement'),
('Partial Repower', 'Partial equipment upgrade'),
('Hybrid System', 'Combination of technologies');