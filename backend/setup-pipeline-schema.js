const { Pool } = require('pg');

console.log('🔧 Setting up pipeline_dashboard schema with approval system...');

async function setup() {
  const postgresPool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'powertransition' 
  });

  try {
    console.log('1. Connecting as postgres user...');
    const client = await postgresPool.connect();
    
    console.log('2. Adding approval system columns to existing tables...');
    
    // Check each column individually and add only if it doesn't exist
    const columnsToAdd = [
      { name: 'status', type: 'VARCHAR(20) DEFAULT \'pending_approval\'' },
      { name: 'approved_by', type: 'INTEGER REFERENCES pipeline_dashboard.users(id)' },
      { name: 'approved_at', type: 'TIMESTAMP' },
      { name: 'rejection_reason', type: 'TEXT' },
      { name: 'failed_login_attempts', type: 'INTEGER DEFAULT 0' },
      { name: 'account_locked', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'lock_until', type: 'TIMESTAMP' },
      { name: 'role', type: 'VARCHAR(20) DEFAULT \'pending\'' }
    ];
    
    for (const column of columnsToAdd) {
      const checkColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'pipeline_dashboard' 
        AND table_name = 'users' 
        AND column_name = $1
      `, [column.name]);
      
      if (checkColumn.rows.length === 0) {
        console.log(`   - Adding ${column.name} column...`);
        try {
          await client.query(`
            ALTER TABLE pipeline_dashboard.users 
            ADD COLUMN ${column.name} ${column.type}
          `);
          console.log(`   ✅ Added ${column.name} column`);
        } catch (error) {
          console.log(`   ⚠️  Could not add ${column.name}: ${error.message}`);
        }
      } else {
        console.log(`   ✅ ${column.name} column already exists`);
      }
    }
    
    // Add constraints if they don't exist
    console.log('   - Adding constraints...');
    try {
      await client.query(`
        ALTER TABLE pipeline_dashboard.users 
        DROP CONSTRAINT IF EXISTS valid_status
      `);
      await client.query(`
        ALTER TABLE pipeline_dashboard.users 
        ADD CONSTRAINT valid_status 
        CHECK (status IN ('pending_approval', 'active', 'rejected', 'suspended'))
      `);
      console.log('   ✅ Added status constraint');
    } catch (error) {
      console.log(`   ⚠️  Status constraint: ${error.message}`);
    }
    
    try {
      await client.query(`
        ALTER TABLE pipeline_dashboard.users 
        DROP CONSTRAINT IF EXISTS valid_role
      `);
      await client.query(`
        ALTER TABLE pipeline_dashboard.users 
        ADD CONSTRAINT valid_role 
        CHECK (role IN ('pending', 'operator', 'engineer', 'admin', 'viewer'))
      `);
      console.log('   ✅ Added role constraint');
    } catch (error) {
      console.log(`   ⚠️  Role constraint: ${error.message}`);
    }
    
    // Check if admin_actions table exists
    const checkAdminActions = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'pipeline_dashboard' 
      AND table_name = 'admin_actions'
    `);
    
    if (checkAdminActions.rows.length === 0) {
      console.log('   - Creating admin_actions table...');
      await client.query(`
        CREATE TABLE pipeline_dashboard.admin_actions (
          id SERIAL PRIMARY KEY,
          admin_id INTEGER REFERENCES pipeline_dashboard.users(id) ON DELETE SET NULL,
          target_user_id INTEGER REFERENCES pipeline_dashboard.users(id) ON DELETE CASCADE,
          action_type VARCHAR(20) NOT NULL,
          previous_status VARCHAR(20),
          new_status VARCHAR(20),
          previous_role VARCHAR(20),
          new_role VARCHAR(20),
          notes TEXT,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT valid_action_type CHECK (action_type IN ('approve', 'reject', 'role_change', 'activate', 'suspend'))
        )
      `);
      console.log('   ✅ Created admin_actions table');
    } else {
      console.log('   ✅ admin_actions table already exists');
    }
    
    // Check if approval_tokens table exists
    const checkApprovalTokens = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'pipeline_dashboard' 
      AND table_name = 'approval_tokens'
    `);
    
    if (checkApprovalTokens.rows.length === 0) {
      console.log('   - Creating approval_tokens table...');
      await client.query(`
        CREATE TABLE pipeline_dashboard.approval_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES pipeline_dashboard.users(id) ON DELETE CASCADE,
          token VARCHAR(64) UNIQUE NOT NULL,
          token_type VARCHAR(20) DEFAULT 'admin_approval',
          admin_email VARCHAR(100),
          expires_at TIMESTAMP NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          used_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created approval_tokens table');
    } else {
      console.log('   ✅ approval_tokens table already exists');
    }
    
    console.log('3. Updating existing demo users status...');
    
    // First check if existing users have status
    const checkUserStatus = await client.query(`
      SELECT username, status, role 
      FROM pipeline_dashboard.users 
      WHERE username IN ('admin', 'operator', 'engineer')
    `);
    
    console.log('   Current demo user status:');
    checkUserStatus.rows.forEach(user => {
      console.log(`   - ${user.username}: status=${user.status || 'NULL'}, role=${user.role || 'NULL'}`);
    });
    
    // Update admin user
    await client.query(`
      UPDATE pipeline_dashboard.users 
      SET status = 'active', 
          role = 'admin',
          approved_at = COALESCE(approved_at, NOW()),
          approved_by = COALESCE(approved_by, (SELECT id FROM pipeline_dashboard.users WHERE username = 'admin' LIMIT 1))
      WHERE username = 'admin'
    `);
    
    // Update operator user
    await client.query(`
      UPDATE pipeline_dashboard.users 
      SET status = 'active', 
          role = 'operator',
          approved_at = COALESCE(approved_at, NOW()),
          approved_by = COALESCE(approved_by, (SELECT id FROM pipeline_dashboard.users WHERE username = 'admin' LIMIT 1))
      WHERE username = 'operator'
    `);
    
    // Update engineer user
    await client.query(`
      UPDATE pipeline_dashboard.users 
      SET status = 'active', 
          role = 'engineer',
          approved_at = COALESCE(approved_at, NOW()),
          approved_by = COALESCE(approved_by, (SELECT id FROM pipeline_dashboard.users WHERE username = 'admin' LIMIT 1))
      WHERE username = 'engineer'
    `);
    
    console.log('✅ Demo users updated with approval status');
    
    console.log('4. Creating indexes...');
    
    // Create indexes if they don't exist
    const indexes = [
      { name: 'idx_users_status', sql: 'CREATE INDEX IF NOT EXISTS idx_users_status ON pipeline_dashboard.users(status)' },
      { name: 'idx_users_role', sql: 'CREATE INDEX IF NOT EXISTS idx_users_role ON pipeline_dashboard.users(role)' },
      { name: 'idx_users_email', sql: 'CREATE INDEX IF NOT EXISTS idx_users_email ON pipeline_dashboard.users(email)' },
      { name: 'idx_admin_actions_target', sql: 'CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON pipeline_dashboard.admin_actions(target_user_id)' },
      { name: 'idx_approval_tokens_token', sql: 'CREATE INDEX IF NOT EXISTS idx_approval_tokens_token ON pipeline_dashboard.approval_tokens(token)' },
      { name: 'idx_approval_tokens_user', sql: 'CREATE INDEX IF NOT EXISTS idx_approval_tokens_user ON pipeline_dashboard.approval_tokens(user_id)' }
    ];
    
    for (const index of indexes) {
      try {
        await client.query(index.sql);
        console.log(`   ✅ Created/verified index: ${index.name}`);
      } catch (error) {
        console.log(`   ⚠️  Index ${index.name}: ${error.message}`);
      }
    }
    
    console.log('5. Verifying setup...');
    
    // Verify users
    const users = await client.query(`
      SELECT username, email, role, status, approved_at 
      FROM pipeline_dashboard.users 
      ORDER BY username
    `);
    
    console.log('\n📊 Current Users:');
    console.log('='.repeat(60));
    console.log('Username  | Email                     | Role     | Status');
    console.log('-'.repeat(60));
    users.rows.forEach(user => {
      const email = user.email || '';
      console.log(`${user.username.padEnd(9)} | ${email.padEnd(25)} | ${(user.role || '').padEnd(8)} | ${user.status || 'NULL'}`);
    });
    console.log('='.repeat(60));
    
    // Check table structures
    console.log('\n📋 Table Structures:');
    const tables = ['users', 'admin_actions', 'approval_tokens', 'login_logs'];
    
    for (const table of tables) {
      const tableInfo = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'pipeline_dashboard' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`\n${table.toUpperCase()}:`);
      if (tableInfo.rows.length > 0) {
        tableInfo.rows.forEach(col => {
          console.log(`  - ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
      } else {
        console.log(`  Table not found`);
      }
    }
    
    client.release();
    await postgresPool.end();
    
    console.log('\n🎉 SETUP COMPLETE!');
    console.log('\n🚀 Next steps:');
    console.log('1. Restart your server: Ctrl+C then node server.cjs');
    console.log('2. Test registration with curl:');
    console.log(`
curl -X POST http://localhost:3001/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPass123!",
    "full_name": "Test User"
  }'
    `);
    console.log('3. Check server console for approval links');
    console.log('4. Login as admin (username: admin, password: PipelineSecure2024!)');
    console.log('5. Go to /admin/approvals to approve users');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    if (error.code === '28P01') {
      console.log('\n💡 PostgreSQL authentication failed.');
      console.log('Check your password in the setup script.');
    } else if (error.code === '42P01') {
      console.log('\n💡 Table does not exist.');
      console.log('Run the original setup script first to create basic tables.');
    }
  }
}

// Run setup
setup();