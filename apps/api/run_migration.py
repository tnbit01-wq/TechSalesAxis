import sys
sys.path.insert(0, '.')

# Try to import database connection
try:
    from src.core.database import db_engine
    print("✓ Database module imported successfully")
    print(f"✓ Database engine: {db_engine}")
    
    # Read the SQL migration file
    with open("../../CAREER_READINESS_MIGRATION_COMPLETE.sql", "r") as f:
        sql_script = f.read()
    
    print(f"✓ Migration SQL loaded ({len(sql_script)} bytes)")
    
    # Execute the migration
    with db_engine.begin() as connection:
        # Execute the SQL script (needs to handle multiple statements)
        statements = [s.strip() for s in sql_script.split(';') if s.strip()]
        for statement in statements:
            if statement and not statement.startswith('--'):
                connection.execute(statement)
        print("✓ Migration executed successfully")
        print("✓ COMMIT successful (transaction completed)")
        
except Exception as e:
    print(f"✗ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
