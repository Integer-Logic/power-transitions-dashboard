#!/usr/bin/env python3
"""
POI Voltage Import Script
This script imports POI Voltage data from kV_list.xlsx into the database.
"""

import pandas as pd
import psycopg2
import os
import sys
from datetime import datetime

def get_db_connection():
    """Create and return a database connection."""
    try:
        # Update these values with your actual database credentials
        conn = psycopg2.connect(
            host="localhost",  # or your database host
            database="pipeline_dashboard",
            user="dashboard_admin",
            password="your_password_here",  # Replace with your actual password
            port="5432"
        )
        return conn
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        sys.exit(1)

def import_poi_voltage():
    """Import POI Voltage data from Excel to database."""
    
    # 1. Check if Excel file exists
    excel_file = "kV_list.xlsx"
    if not os.path.exists(excel_file):
        print(f"❌ Error: {excel_file} not found!")
        print(f"   Please place {excel_file} in the same directory as this script.")
        sys.exit(1)
    
    # 2. Read Excel file
    print(f"📖 Reading {excel_file}...")
    try:
        df = pd.read_excel(excel_file)
        print(f"✅ Found {len(df)} projects in Excel file")
        
        # Display first few rows for verification
        print("\n📋 Sample data from Excel:")
        print(df.head())
        
    except Exception as e:
        print(f"❌ Error reading Excel file: {e}")
        sys.exit(1)
    
    # 3. Connect to database
    print("\n🔗 Connecting to database...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 4. Prepare statistics
        updated_count = 0
        not_found = []
        already_have_value = []
        errors = []
        
        # 5. Process each row
        print(f"\n🔄 Processing {len(df)} projects...")
        
        for index, row in df.iterrows():
            project_name = str(row['Project Name']).strip()
            poi_voltage = row['POI Voltage (KV)']
            
            # Handle NaN values
            if pd.isna(poi_voltage):
                continue
            
            try:
                # Convert to numeric if possible
                poi_voltage = float(poi_voltage)
            except:
                errors.append(f"{project_name}: Invalid voltage value '{poi_voltage}'")
                continue
            
            # Debug: Show what we're processing
            if index < 5:  # Show first 5 for debugging
                print(f"  Processing: '{project_name}' -> {poi_voltage} KV")
            
            # 6. Check if project exists AND doesn't already have a value
            cursor.execute("""
                SELECT COUNT(*), MAX(poi_voltage_kv) 
                FROM pipeline_dashboard.projects 
                WHERE project_name ILIKE %s
            """, (project_name,))
            
            result = cursor.fetchone()
            count = result[0]
            existing_value = result[1]
            
            if count == 0:
                # Project not found
                not_found.append(project_name)
                
            elif existing_value is not None:
                # Project already has a POI voltage value
                already_have_value.append(f"{project_name} (has: {existing_value} KV)")
                
            else:
                # Project exists and doesn't have POI voltage - update it
                update_query = """
                    UPDATE pipeline_dashboard.projects 
                    SET poi_voltage_kv = %s, 
                        updated_at = CURRENT_TIMESTAMP,
                        updated_by = 'import_script'
                    WHERE project_name ILIKE %s
                """
                
                cursor.execute(update_query, (poi_voltage, project_name))
                
                if cursor.rowcount > 0:
                    updated_count += 1
                    if updated_count <= 10:  # Show first 10 updates
                        print(f"  ✓ Updated: {project_name} -> {poi_voltage} KV")
        
        # 7. Commit changes
        conn.commit()
        
        # 8. Print summary
        print("\n" + "="*60)
        print("📊 IMPORT SUMMARY")
        print("="*60)
        print(f"✅ Successfully updated: {updated_count} projects")
        
        if not_found:
            print(f"\n❌ Not found in database ({len(not_found)} projects):")
            for project in not_found[:10]:  # Show first 10
                print(f"  - {project}")
            if len(not_found) > 10:
                print(f"  ... and {len(not_found) - 10} more")
        
        if already_have_value:
            print(f"\n⚠️  Already have POI Voltage ({len(already_have_value)} projects):")
            for project in already_have_value[:5]:  # Show first 5
                print(f"  - {project}")
            if len(already_have_value) > 5:
                print(f"  ... and {len(already_have_value) - 5} more")
        
        if errors:
            print(f"\n❗ Errors ({len(errors)} projects):")
            for error in errors[:5]:
                print(f"  - {error}")
            if len(errors) > 5:
                print(f"  ... and {len(errors) - 5} more")
        
        # 9. Show some sample data from database
        print("\n" + "="*60)
        print("🧪 VERIFICATION - Sample data from database:")
        print("="*60)
        
        cursor.execute("""
            SELECT project_name, poi_voltage_kv 
            FROM pipeline_dashboard.projects 
            WHERE poi_voltage_kv IS NOT NULL 
            LIMIT 5
        """)
        
        sample_data = cursor.fetchall()
        if sample_data:
            for project, voltage in sample_data:
                print(f"  {project}: {voltage} KV")
        else:
            print("  No projects with POI Voltage found in database")
        
        # 10. Show total count
        cursor.execute("SELECT COUNT(*) FROM pipeline_dashboard.projects WHERE poi_voltage_kv IS NOT NULL")
        total_with_voltage = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM pipeline_dashboard.projects")
        total_projects = cursor.fetchone()[0]
        
        print(f"\n📈 Database stats: {total_with_voltage}/{total_projects} projects have POI Voltage")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        cursor.close()
        conn.close()
        print("\n🔌 Database connection closed")

if __name__ == "__main__":
    print("🚀 POI Voltage Import Script")
    print("="*60)
    
    # Check if we have pandas and psycopg2 installed
    try:
        import pandas
        import psycopg2
    except ImportError as e:
        print(f"❌ Missing required package: {e}")
        print("\nPlease install required packages:")
        print("  pip install pandas psycopg2-binary openpyxl")
        sys.exit(1)
    
    import_poi_voltage()
    print("\n✨ Import process completed!")