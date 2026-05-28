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
    CREATE TABLE IF NOT EXISTS public.assessment_feedback (
        id uuid PRIMARY KEY,
        candidate_id uuid REFERENCES users(id),
        session_id uuid REFERENCES assessment_sessions(id),
        feedback_report jsonb DEFAULT '{}'::jsonb,
        strengths text[],
        improvement_areas text[],
        recommendations text[],
        tier varchar,
        final_score integer,
        generated_at timestamptz DEFAULT now(),
        viewed_at timestamptz,
        created_at timestamptz DEFAULT now()
    );
    """

    print('Dry-run SQL to create assessment_feedback table:')
    print(sql)

    if dry_run:
        print('\nDry-run mode; not executing SQL. Re-run with --apply to apply.')
        return 0

    engine = create_engine(db_url)
    print('Connecting to database...')
    with engine.begin() as conn:
        conn.execute(text(sql))
    print('Table `assessment_feedback` created or already existed.')
    return 0


if __name__ == '__main__':
    import argparse

    p = argparse.ArgumentParser(description='Create assessment_feedback table if missing')
    p.add_argument('--apply', action='store_true', help='Apply the migration (default is dry-run)')
    args = p.parse_args()
    raise SystemExit(main(dry_run=not args.apply))
