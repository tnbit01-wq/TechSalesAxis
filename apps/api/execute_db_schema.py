#!/usr/bin/env python3
"""
Execute bulk upload database schema creation
Handles connection to PostgreSQL and executes all DDL statements
"""

import psycopg2
import psycopg2.extras
import os
import sys
from pathlib import Path

def execute_schema():
    """Execute the database schema file"""
    
    # Configuration
    DB_CONFIG = {
        'dbname': 'talentflow',
        'user': 'postgres',
        'host': 'localhost',
        'port': 5432,
    }
    
    # Try multiple password combinations
    passwords = ['postgres', '', 'Postgres123!', 'password']
    
    conn = None
    for pwd in passwords:
        try:
            db_config = DB_CONFIG.copy()
            if pwd:
                db_config['password'] = pwd
            
            conn = psycopg2.connect(**db_config)
            print(f"✓ PostgreSQL Connected with password attempt")
            break
        except psycopg2.OperationalError as e:
            if pwd == passwords[-1]:
                print(f"✗ Could not connect to PostgreSQL: {e}")
                sys.exit(1)
            continue
    
    if not conn:
        print("✗ Failed to establish database connection")
        sys.exit(1)
    
    try:
        cur = conn.cursor()
        
        # Read schema file
        schema_file = Path(__file__).parent.parent.parent / "docs" / "BULK_UPLOAD_DATABASE_SCHEMA.sql"
        print(f"Reading schema from: {schema_file}")
        
        with open(schema_file, 'r') as f:
            schema_sql = f.read()
        
        # Execute schema
        print("Executing schema creation...")
        cur.execute(schema_sql)
        conn.commit()
        
        print("✓ Schema executed successfully")
        
        # Verify tables were created
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE 'bulk_%'
            ORDER BY table_name;
        """)
        
        tables = cur.fetchall()
        print(f"\n✓ Created {len(tables)} tables:")
        for table in tables:
            print(f"  - {table[0]}")
        
        # Verify indexes
        cur.execute("""
            SELECT indexname FROM pg_indexes 
            WHERE tablename LIKE 'bulk_%'
            ORDER BY tablename;
        """)
        
        indexes = cur.fetchall()
        print(f"\n✓ Created {len(indexes)} indexes")
        
        # Verify materialized view
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'VIEW'
            AND table_name = 'bulk_upload_summary';
        """)
        
        view = cur.fetchone()
        if view:
            print(f"✓ Materialized view 'bulk_upload_summary' created")
        
        print("\n" + "="*60)
        print("DATABASE SCHEMA CREATION COMPLETED SUCCESSFULLY!")
        print("="*60)
        
        cur.close()
        
    except Exception as e:
        print(f"✗ Error executing schema: {e}")
        conn.rollback()
        sys.exit(1)
    
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    execute_schema()
