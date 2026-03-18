import psycopg2

db_url = "postgresql://postgres:tX6v2KraCehQkZR@talentflow-db.cjymcuai297y.ap-southeast-2.rds.amazonaws.com:5432/talentflow"

def fix_test_data():
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. Update the slot (Mohith's test case)
        # Slot: 496a6051-6557-4b5d-813b-3c2bf7b7dfc4 (Mohith 4:54 PM)
        # Interview: 180ef59f-fe3c-44eb-a9c9-ca70d02868a5
        
        cur.execute("""
            UPDATE interview_slots 
            SET is_selected = True, status = 'selected' 
            WHERE id = '496a6051-6557-4b5d-813b-3c2bf7b7dfc4';
            
            UPDATE interview_slots
            SET is_selected = False, status = 'not_selected'
            WHERE interview_id = '180ef59f-fe3c-44eb-a9c9-ca70d02868a5'
            AND id != '496a6051-6557-4b5d-813b-3c2bf7b7dfc4';

            UPDATE interviews 
            SET status = 'scheduled' 
            WHERE id = '180ef59f-fe3c-44eb-a9c9-ca70d02868a5';

            UPDATE job_applications
            SET status = 'interview_scheduled'
            WHERE id = (SELECT application_id FROM interviews WHERE id = '180ef59f-fe3c-44eb-a9c9-ca70d02868a5');

            COMMIT;
        """)
        
        print("Successfully patched database for Mohith's interview.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"PATCH ERROR: {e}")

if __name__ == "__main__":
    fix_test_data()