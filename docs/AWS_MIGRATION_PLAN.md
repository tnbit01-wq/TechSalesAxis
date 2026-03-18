# AWS Migration & Infrastructure Planning (TALENTFLOW)

## 1. Executive Summary
The project is migrating from Supabase to AWS to address database storage limitations and scale efficiently. Supabase's pricing model for large datasets (after 8GB) becomes prohibitively expensive compared to AWS managed services.

## 2. Infrastructure Replacement Mapping
| Component | Supabase Service | AWS Service | Reason |
| :--- | :--- | :--- | :--- |
| **Database** | Postgres (Managed) | **AWS RDS for PostgreSQL** | Predictable scaling, decoupled storage costs. |
| **Storage** | Supabase Storage | **AWS S3** | Standard for high-volume file storage (Resumes/Docs). |
| **Auth** | Supabase Auth (GoTrue) | **AWS Cognito** or **Auth0** | Enterprise-grade identity management. |
| **Functions** | Edge Functions | **AWS Lambda** | Better integration with other AWS services. |

## 3. Estimated Cost Analysis (Starting)
*Prices are estimates based on US-East-1 region.*

### A. Database (AWS RDS / Aurora)
*   **Aurora Serverless v2:** ~$0.12/ACU-hour. Min 0.5 ACU = ~$43/month.
*   **RDS (db.t4g.micro):** ~$15 - $20/month.
*   **Storage (EBS):** ~$0.115 per GB/month. 100GB = ~$11.50.
*   **Recommendation:** Start with RDS `db.t3.medium` for production-grade performance (~$50/mo).

### B. Storage (AWS S3)
*   **Storage:** $0.023 per GB/month.
*   **Requests:** ~$0.005 per 1,000 PUT/POST.
*   **Estimated Cost:** Negligible for starting users (~$1-$5/mo).

### C. Compute (AWS Lambda / ECS)
*   **Lambda (Free Tier):** 1M free requests/month.
*   **Next.js (Vercel or AWS Amplify/App Runner):** ~$15 - $30/mo.

### D. Total Monthly Projection (Starter Production)
*   **Conservative:** ~$70 - $100 / month.
*   **Scalable (Aurora + ECS):** ~$150+ / month.

---

## 4. Phase-wise Implementation Plan

### Phase 1: Database Migration (Weeks 1-2)
1.  **Direct DB Switch:** Provision RDS/Aurora.
2.  **Schema Export:** `pg_dump` from Supabase to RDS.
3.  **API Refactor:** Replace `supabase-py` client with `SQLAlchemy` or `psycopg2` in the Python backend.

### Phase 2: Storage & File Assets (Week 3)
1.  **S3 Bucket Setup:** Enable public/private access controls.
2.  **Migration Script:** Transfer existing resumes from Supabase buckets to S3.
3.  **Update URLs:** Update database records to point to new S3 signed URLs.

### Phase 3: Auth & Identity (Weeks 4+)
1.  **Oauth/Cognito Config:** Set up User Pools.
2.  **User Migration:** Export Supabase users to JSON and import to Cognito.
3.  **Frontend Update:** Replace `@supabase/auth-helpers` with AWS Amplify SDK or `next-auth`.

---

## 5. Risk Assessment
*   **Downtime:** Requires a maintenance window for final DB sync.
*   **Data Consistency:** Need a strict write-lock on Supabase during the final migration step.
*   **RLS Logic:** Row Level Security in Supabase must be manually ported as Application-Level logic or native Postgres RLS in RDS.

---

**Prepared by:** GitHub Copilot (Gemini 3 Flash)
**Date:** March 6, 2026
