import os
import boto3
from supabase import create_client
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load env from local apps/api/.env first, then root as backup
load_dotenv('.env')
load_dotenv('../../.env')

# Supabase Config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use Service Role for migration
if not SUPABASE_KEY or SUPABASE_KEY == "...":
    SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# AWS Config
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")
DATABASE_URL = os.getenv("DATABASE_URL")

def list_recursive(supabase, bucket_id, path=""):
    all_files = []
    items = supabase.storage.from_(bucket_id).list(path)
    for item in items:
        name = item['name']
        full_path = f"{path}/{name}" if path else name
        
        # Folder check
        if item.get('id') is None and item.get('metadata') is None:
            # It's a folder, recurse
            all_files.extend(list_recursive(supabase, bucket_id, full_path))
        else:
            # It's a file
            item['full_path'] = full_path
            all_files.append(item)
    return all_files

def migrate_storage():
    print(f"🚀 Starting Storage Migration to S3: {S3_BUCKET}...")
    print(f"🔗 Supabase URL: {SUPABASE_URL}")
    print(f"🔑 Supabase Key Length: {len(SUPABASE_KEY) if SUPABASE_KEY else 0}")
    
    # Clients
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    s3_client = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )
    
    # List buckets in Supabase
    try:
        buckets = supabase.storage.list_buckets()
        print(f"📦 Found {len(buckets)} Supabase buckets.")
    except Exception as e:
        print(f"❌ Error listing Supabase buckets: {e}")
        return

    # Tracking for DB updates
    migration_map = {}

    for bucket in buckets:
        bucket_id = bucket.id
        print(f"\n📂 Migrating bucket: {bucket_id}")
        
        # Get all files recursively
        files = list_recursive(supabase, bucket_id)
        if not files:
            print("  🏜️ Bucket is empty.")
            continue

        for file in files:
            file_name = file['name']
            full_path = file['full_path']
            
            if file_name == '.emptyFolderPlaceholder':
                continue
                
            print(f"  📄 Transferring: {full_path}...", end="", flush=True)
            
            try:
                # Download from Supabase
                res = supabase.storage.from_(bucket_id).download(full_path)
                
                # Upload to S3
                s3_key = f"{bucket_id}/{full_path}"
                s3_client.put_object(
                    Bucket=S3_BUCKET,
                    Key=s3_key,
                    Body=res
                )
                
                # Construct new URL
                new_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
                migration_map[f"{bucket_id}/{file_name}"] = new_url
                print(" ✅")
                
            except Exception as e:
                print(f" ❌ Failed: {e}")

    # Update Database URLs
    if migration_map:
        print("\n🗄️ Updating Database URLs in RDS...")
        engine = create_engine(DATABASE_URL)
        with engine.begin() as conn:
            for old_path, new_url in migration_map.items():
                filename = old_path.split('/')[-1]
                bucket = old_path.split('/')[0]
                
                # Resumes
                if bucket == 'resumes':
                    conn.execute(
                        text("UPDATE candidate_profiles SET resume_path = :new_url WHERE resume_path LIKE :old_pattern"),
                        {"new_url": new_url, "old_pattern": f"%{filename}%"}
                    )
                # Profile Photos
                elif bucket in ['profile_photos', 'avatars']:
                    conn.execute(
                        text("UPDATE candidate_profiles SET profile_photo_url = :new_url WHERE profile_photo_url LIKE :old_pattern"),
                        {"new_url": new_url, "old_pattern": f"%{filename}%"}
                    )
                # ID Proofs
                elif bucket == 'id-proofs':
                    conn.execute(
                        text("UPDATE candidate_profiles SET identity_proof_path = :new_url WHERE identity_proof_path LIKE :old_pattern"),
                        {"new_url": new_url, "old_pattern": f"%{filename}%"}
                    )
                # Company/Recruiter Assets
                elif bucket in ['company-logos', 'company-assets']:
                    conn.execute(
                        text("UPDATE companies SET logo_url = :new_url WHERE logo_url LIKE :old_pattern"),
                        {"new_url": new_url, "old_pattern": f"%{filename}%"}
                    )
                    # Also try updating life_at_photo_urls if it contains the filename
                    # This is a JSONB/Array field usually, so we use a fuzzy match update
                    conn.execute(
                        text("UPDATE companies SET life_at_photo_urls = array_replace(life_at_photo_urls, :old_url, :new_url) WHERE :old_url = ANY(life_at_photo_urls)"),
                        {"new_url": new_url, "old_url": filename} # Simplified placeholder
                    )
        print("🎉 Database URLs updated to S3!")

if __name__ == "__main__":
    migrate_storage()
