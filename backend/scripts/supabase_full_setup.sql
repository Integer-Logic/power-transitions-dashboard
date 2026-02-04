-- ============================================
-- SUPABASE FULL SETUP - Pipeline Dashboard
-- ============================================
-- This creates all tables in the pipeline_dashboard schema (private)
-- ============================================

SET client_encoding = 'UTF8';

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS pipeline_dashboard;
SET search_path TO pipeline_dashboard;

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'pending' CHECK (role IN ('pending', 'operator', 'engineer', 'admin', 'viewer')),
    status VARCHAR(20) DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'rejected', 'suspended')),
    is_verified BOOLEAN DEFAULT false,
    approved_by INTEGER,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked BOOLEAN DEFAULT FALSE,
    lock_until TIMESTAMP,
    reset_password_token VARCHAR(100),
    reset_password_expires TIMESTAMP,
    last_login TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Self-referencing foreign key for approved_by
ALTER TABLE users ADD CONSTRAINT fk_users_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Login Logs
CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(100),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP,
    session_duration INTEGER
);

-- 4. Admin Actions (for audit trail)
CREATE TABLE IF NOT EXISTS admin_actions (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('approve', 'reject', 'role_change', 'activate', 'suspend')),
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    previous_role VARCHAR(20),
    new_role VARCHAR(20),
    notes TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Approval Tokens
CREATE TABLE IF NOT EXISTS approval_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    token_type VARCHAR(20) DEFAULT 'admin_approval',
    admin_email VARCHAR(100),
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PROJECTS & CORE DATA
-- ============================================

-- 6. Projects Table
CREATE TABLE IF NOT EXISTS projects (
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

-- 7. Technical Details
CREATE TABLE IF NOT EXISTS technical_details (
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

-- 8. Market Details
CREATE TABLE IF NOT EXISTS market_details (
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

-- 9. Redevelopment Details
CREATE TABLE IF NOT EXISTS redevelopment_details (
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

-- 10. Scores
CREATE TABLE IF NOT EXISTS scores (
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

-- ============================================
-- LOOKUP TABLES
-- ============================================

-- 11. Project Types
CREATE TABLE IF NOT EXISTS project_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    color_code VARCHAR(7)
);

-- 12. Redevelopment Base Cases
CREATE TABLE IF NOT EXISTS redev_base_cases (
    id SERIAL PRIMARY KEY,
    base_case_name VARCHAR(100) UNIQUE NOT NULL
);

-- 13. Redevelopment Fuels
CREATE TABLE IF NOT EXISTS redev_fuels (
    id SERIAL PRIMARY KEY,
    fuel_name VARCHAR(50) UNIQUE NOT NULL
);

-- 14. Redevelopment Lead Options
CREATE TABLE IF NOT EXISTS redev_lead_options (
    id SERIAL PRIMARY KEY,
    lead_name VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Redevelopment Support Options
CREATE TABLE IF NOT EXISTS redev_support_options (
    id SERIAL PRIMARY KEY,
    support_name VARCHAR(100) UNIQUE NOT NULL,
    team VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Co-locate/Repower Options
CREATE TABLE IF NOT EXISTS co_locate_repower_options (
    id SERIAL PRIMARY KEY,
    option_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MAPPING TABLES (Many-to-Many)
-- ============================================

-- 17. Project Type Mappings
CREATE TABLE IF NOT EXISTS project_type_mappings (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    project_type_id INTEGER REFERENCES project_types(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, project_type_id)
);

-- 18. Redevelopment Base Case Mappings
CREATE TABLE IF NOT EXISTS redev_base_case_mappings (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    base_case_id INTEGER REFERENCES redev_base_cases(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, base_case_id)
);

-- 19. Redevelopment Fuel Mappings
CREATE TABLE IF NOT EXISTS redev_fuel_mappings (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    fuel_id INTEGER REFERENCES redev_fuels(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, fuel_id)
);

-- ============================================
-- CONTACTS & AUDIT
-- ============================================

-- 20. Contacts
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    contact_name VARCHAR(255),
    contact_details TEXT,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(100) DEFAULT 'system',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token) WHERE reset_password_token IS NOT NULL;

-- Login logs indexes
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_login_time ON login_logs(login_time);

-- Admin actions indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_user_id);

-- Approval tokens indexes
CREATE INDEX IF NOT EXISTS idx_approval_tokens_token ON approval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_approval_tokens_user ON approval_tokens(user_id);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(plant_owner);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Detail tables indexes
CREATE INDEX IF NOT EXISTS idx_technical_project_id ON technical_details(project_id);
CREATE INDEX IF NOT EXISTS idx_market_project_id ON market_details(project_id);
CREATE INDEX IF NOT EXISTS idx_redev_project_id ON redevelopment_details(project_id);
CREATE INDEX IF NOT EXISTS idx_scores_project_id ON scores(project_id);

-- Audit index
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- 22. Update Timestamp Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 23. Audit Log Function
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

-- 24. Apply Update Triggers
CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_timestamp BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_technical_timestamp BEFORE UPDATE ON technical_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_timestamp BEFORE UPDATE ON market_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_redev_timestamp BEFORE UPDATE ON redevelopment_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 25. Apply Audit Triggers
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON projects
FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_technical AFTER INSERT OR UPDATE OR DELETE ON technical_details
FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_market AFTER INSERT OR UPDATE OR DELETE ON market_details
FOR EACH ROW EXECUTE FUNCTION log_changes();

CREATE TRIGGER audit_redevelopment AFTER INSERT OR UPDATE OR DELETE ON redevelopment_details
FOR EACH ROW EXECUTE FUNCTION log_changes();

-- ============================================
-- DEFAULT DATA
-- ============================================

-- 26. Project Types
INSERT INTO project_types (type_name, color_code) VALUES
('Redev', '#10b981'),
('M&A', '#f59e0b'),
('Owned', '#8b5cf6')
ON CONFLICT (type_name) DO NOTHING;

-- 27. Redevelopment Fuels
INSERT INTO redev_fuels (fuel_name) VALUES
('Gas'),
('Coal'),
('Oil'),
('Nuclear'),
('Biomass'),
('Diesel'),
('N/A')
ON CONFLICT (fuel_name) DO NOTHING;

-- 28. Redevelopment Base Cases
INSERT INTO redev_base_cases (base_case_name) VALUES
('BESS'),
('Gas/Thermal'),
('Solar'),
('Powered Land'),
('Dual Fuel Recips'),
('Datacenter'),
('Plant Optimization')
ON CONFLICT (base_case_name) DO NOTHING;

-- 29. Redevelopment Lead Options
INSERT INTO redev_lead_options (lead_name, department) VALUES
('John Doe', 'Development'),
('Jane Smith', 'Engineering'),
('Mike Johnson', 'Project Management'),
('Sarah Williams', 'Business Development')
ON CONFLICT (lead_name) DO NOTHING;

-- 30. Redevelopment Support Options
INSERT INTO redev_support_options (support_name, team) VALUES
('Engineering', 'Technical'),
('Finance', 'Financial'),
('Legal', 'Compliance'),
('Operations', 'Execution'),
('Regulatory', 'Permitting')
ON CONFLICT (support_name) DO NOTHING;

-- 31. Co-locate/Repower Options
INSERT INTO co_locate_repower_options (option_name, description) VALUES
('Solar Co-location', 'Adding solar to existing site'),
('BESS Co-location', 'Adding battery storage'),
('Full Repower', 'Complete equipment replacement'),
('Partial Repower', 'Partial equipment upgrade'),
('Hybrid System', 'Combination of technologies')
ON CONFLICT (option_name) DO NOTHING;

-- 32. Demo Users (password: PipelineSecure2024!)
-- Hash generated with bcrypt, 12 rounds
INSERT INTO users (username, email, password_hash, full_name, role, status, is_verified, login_count) VALUES
('admin', 'admin@powerpipeline.com', '$2a$12$LQv3c1yqBWVHxkdUx7kfHezB6OYkfT7Z7YkR7NcXqMl9pWtQ6o8O2', 'Administrator', 'admin', 'active', true, 0),
('operator', 'operator@powerpipeline.com', '$2a$12$LQv3c1yqBWVHxkdUx7kfHezB6OYkfT7Z7YkR7NcXqMl9pWtQ6o8O2', 'Control Room Operator', 'operator', 'active', true, 0),
('engineer', 'engineer@powerpipeline.com', '$2a$12$LQv3c1yqBWVHxkdUx7kfHezB6OYkfT7Z7YkR7NcXqMl9pWtQ6o8O2', 'Systems Engineer', 'engineer', 'active', true, 0)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show created tables
SELECT 'Setup complete! Tables created:' as status;
SELECT tablename as table_name
FROM pg_tables
WHERE schemaname = 'pipeline_dashboard'
ORDER BY tablename;
