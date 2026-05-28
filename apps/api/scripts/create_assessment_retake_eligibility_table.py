from pathlib import Path
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text


def main(dry_run=True):
    env_path = Path(__file__).resolve().parents[1] / '.env'
    if env_path.exists():
        load_dotenv(env_path)

    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print('DATABASE_URL not set in environment or apps/api/.env')
        return 2

    sql = """
    CREATE TABLE IF NOT EXISTS public.assessment_retake_eligibility (
        id uuid PRIMARY KEY,
        candidate_id uuid UNIQUE REFERENCES users(id),
        last_completed_at timestamptz DEFAULT now(),
        eligible_after timestamptz NOT NULL,
        retake_count integer DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
    );
    """

    print('Dry-run SQL to create assessment_retake_eligibility table:')
    print(sql)

    if dry_run:
        print('\nDry-run mode; not executing SQL. Re-run with --apply to apply.')
        return 0

    engine = create_engine(db_url)
    print('Connecting to database...')
    with engine.begin() as conn:
        conn.execute(text(sql))
    print('Table `assessment_retake_eligibility` created or already existed.')
    return 0


if __name__ == '__main__':
    import argparse

    p = argparse.ArgumentParser(description='Create assessment_retake_eligibility table if missing')
    p.add_argument('--apply', action='store_true', help='Apply the migration (default is dry-run)')
    args = p.parse_args()
    raise SystemExit(main(dry_run=not args.apply))
