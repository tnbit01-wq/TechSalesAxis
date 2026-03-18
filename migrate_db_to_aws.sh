#!/bin/bash
# TALENTFLOW: Supabase to AWS RDS Table Migration Script

# --- CONFIGURATION (Fill these after provisioning AWS) ---
SB_HOST="db.snzqqjrmthqdezozgvsp.supabase.co"
SB_USER="postgres"
SB_DB="postgres"

AWS_HOST="your-rds-endpoint.aws.com"
AWS_USER="postgres"
AWS_DB="talentflow"

# 1. EXPORT SCHEMA & DATA FROM SUPABASE
echo "Step 1: Exporting current database from Supabase..."
# Note: We exclude 'auth', 'storage', and 'extensions' schemas if you want a clean RDS start.
# If you want everything, remove the --schema flags.
pg_dump -h $SB_HOST -U $SB_USER -d $SB_DB \
    --schema=public \
    --no-owner --no-acl \
    > talentflow_backup.sql

echo "Export complete: talentflow_backup.sql"

# 2. PREPARE AWS RDS
# Make sure you have created the 'talentflow' database in RDS first.
echo "Step 2: Importing into AWS RDS..."
psql -h $AWS_HOST -U $AWS_USER -d $AWS_DB -f talentflow_backup.sql

echo "Migration Successful!"
echo "Check docs/AWS_MIGRATION_PLAN.md for next steps (API connection)."
