#!/usr/bin/env python3
"""
Database Migration Runner
Executes SQL migration for conversational onboarding table
"""

import sys
import os
from pathlib import Path

# Add project to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "apps" / "api"))

from src.core.config import DATABASE_URL
from sqlalchemy import create_engine, text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration():
    """Execute the migration SQL"""
    
    if not DATABASE_URL:
        logger.error("❌ DATABASE_URL environment variable not set!")
        return False
    
    logger.info(f"📡 Connecting to database...")
    logger.info(f"📡 Database URL: {DATABASE_URL[:50]}...")
    
    try:
        # Create engine
        engine = create_engine(DATABASE_URL, echo=False)
        
        # Read migration SQL
        migration_file = Path(__file__).parent / "add_conversational_onboarding_table.sql"
        if not migration_file.exists():
            logger.error(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            sql_content = f.read()
        
        logger.info(f"📄 Loaded migration file: {migration_file}")
        logger.info(f"📄 SQL length: {len(sql_content)} characters")
        
        # Execute migration
        with engine.connect() as conn:
            # Split by semicolon for multiple statements
            statements = [s.strip() for s in sql_content.split(';') if s.strip()]
            
            for i, statement in enumerate(statements, 1):
                if statement:
                    logger.info(f"⏳ Executing statement {i}/{len(statements)}...")
                    try:
                        conn.execute(text(statement))
                        logger.info(f"✅ Statement {i} executed successfully")
                    except Exception as e:
                        logger.error(f"❌ Statement {i} failed: {str(e)}")
                        if "already exists" in str(e).lower():
                            logger.info("   (Table already exists, skipping)")
                            continue
                        raise
            
            # Commit all changes
            conn.commit()
            logger.info("✅ All migrations committed!")
        
        logger.info("✅ ========================================")
        logger.info("✅ Migration completed successfully!")
        logger.info("✅ ========================================")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
