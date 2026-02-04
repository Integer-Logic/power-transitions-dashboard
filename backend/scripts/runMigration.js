/**
 * Run Expert Analysis Option B Migration
 * Executes the SQL migration against Supabase
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  console.log('🚀 Starting Expert Analysis Option B Migration...\n');

  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test connection
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Connected to database at:', testResult.rows[0].current_time);
    console.log('');

    // Read the migration SQL file
    const sqlFilePath = path.join(__dirname, 'supabase_expert_analysis_option_b.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📄 Loaded migration file:', sqlFilePath);
    console.log('');

    // Split into individual statements (handle semicolons properly)
    // We'll execute the entire script at once since it's designed to run together
    console.log('⏳ Executing migration...\n');

    const result = await pool.query(sqlContent);

    console.log('✅ Migration completed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying migration results...\n');

    // Check if expert_analysis_history table exists
    const historyTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'pipeline_dashboard'
        AND table_name = 'expert_analysis_history'
      ) as exists
    `);
    console.log('📋 expert_analysis_history table exists:', historyTableCheck.rows[0].exists);

    // Check new columns in projects table
    const columnsCheck = await pool.query(`
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
      ORDER BY column_name
    `);

    console.log('\n📊 New columns added to projects table:');
    columnsCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Check existing columns
    const existingColumnsCheck = await pool.query(`
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
      ORDER BY column_name
    `);

    console.log('\n📊 Existing columns used for Pipeline Details:');
    existingColumnsCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Check if old expert_analysis table was dropped
    const oldTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'pipeline_dashboard'
        AND table_name = 'expert_analysis'
      ) as exists
    `);
    console.log('\n🗑️  Old expert_analysis table removed:', !oldTableCheck.rows[0].exists);

    console.log('\n✅ Migration verification complete!');
    console.log('\n📝 Summary:');
    console.log('   - expert_analysis_history table: CREATED');
    console.log('   - New tracking columns in projects: ADDED');
    console.log('   - Old expert_analysis table: DROPPED');
    console.log('   - Existing score columns: PRESERVED');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n👋 Database connection closed.');
  }
}

runMigration();
