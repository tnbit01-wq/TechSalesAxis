# Admin Features - Complete Guide

**Version:** 1.0  
**Last Updated:** April 2, 2026  
**Audience:** Platform Administrators, System Managers

---

## 📋 Table of Contents

1. [Admin Dashboard Overview](#admin-dashboard-overview)
2. [User Management](#user-management)
3. [Bulk Upload Management](#bulk-upload-management)
4. [Platform Settings](#platform-settings)
5. [Analytics & Reports](#analytics--reports)
6. [System Configuration](#system-configuration)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🏭 Admin Dashboard Overview

### URL
`http://localhost:3000/admin/dashboard`

### Access Control
- **Role Required:** ADMIN
- **Permissions:** Full platform access
- **Session:** Requires secure authentication

### Dashboard Sections
1. **Quick Stats** - Platform metrics overview
2. **User Management** - Candidate and recruiter accounts
3. **Bulk Upload** - Resume imports and candidates
4. **Platform Settings** - System configuration
5. **Analytics** - Platform-wide insights
6. **Monitoring** - System health and issues

---

## 👥 User Management

### 1. View All Users

#### Search & Filter
```
┌──────────────────────────────────────┐
│ Users Management                     │
├──────────────────────────────────────┤
│ [Search by email/name]               │
│                                      │
│ Filter By:                           │
│ Role: [All ▼]  Status: [Active ▼]   │
│ Joined: [All time ▼]                │
│                                      │
│ Export: [Download CSV] [Download PDF]│
│ Sort: [Date (Newest) ▼]             │
│                                      │
│ Total Users: 2,450 | Page 1-50 of 50│
│                                      │
│ [Candidate] [Recruiter] [Suspended] │
│                                      │
│ Email               | Role      | Status │
│ raja@email.com      | Candidate | Active │
│ priya@company.com   | Recruiter | Active │
│ john@email.com      | Candidate | Suspended│
```

#### User Roles
| Role | Permissions | Can Do |
|------|----------|--------|
| CANDIDATE | Read-only access | View jobs, apply, take assessment |
| RECRUITER | Company access | Post jobs, view candidates, hire |
| ADMIN | Full access | Manage everything, settings, reports |

#### User Statuses
| Status | Meaning | Action |
|--------|---------|--------|
| ACTIVE | Normal account | View, Edit, Suspend |
| SUSPENDED | Blocked temporarily | View, Unsuspend, Delete |
| DELETED | Permanently removed | View audit trail only |
| BANNED | Anti-fraud action | View reason, Appeal option |

### 2. View Individual User Profile

```
┌──────────────────────────────────────┐
│ User Details: Rajesh Kumar           │
├──────────────────────────────────────┤
│ Email: raj@email.com                 │
│ Role: CANDIDATE                      │
│ Status: 🟢 ACTIVE                    │
│ Joined: Mar 15, 2026                 │
│ Last Login: Apr 1, 2026, 2:30 PM    │
│                                      │
│ Trust Score: 82/100 ✓                │
│ Assessments: 1 completed             │
│ Applications: 5 sent                 │
│ Profile Views: 45                    │
│                                      │
│ Phone: +91-XXXXXXXXXX                │
│ Location: Bangalore                  │
│                                      │
│ Warnings/Violations: None            │
│                                      │
│ Recent Activities:                   │
│ • Applied to job (2 hours ago)       │
│ • Viewed 3 companies (5 hours ago)   │
│ • Updated profile (1 day ago)        │
│                                      │
│ [Edit] [Suspend] [Delete] [Message] │
│ [View Full Profile] [Download Data] │
└──────────────────────────────────────┘
```

### 3. Suspend or Delete Account

#### Suspend Account
```
┌──────────────────────────────────┐
│ Suspend Account                  │
├──────────────────────────────────┤
│ User: john@email.com             │
│ Reason: [Spam Activities ▼]     │
│                                  │
│ Options:                         │
│ ☑ Notify user via email         │
│ ☑ Keep applications alive       │
│ ◯ 24 hours  ◉ Indefinite       │
│                                  │
│ Message to user:                 │
│ [Your account has been...]      │
│                                  │
│ [Suspend] [Cancel]               │
└──────────────────────────────────┘
```

#### Delete Account
```
┌──────────────────────────────────┐
│ Permanently Delete Account       │
├──────────────────────────────────┤
│ User: john@email.com             │
│ Warning: This action is          │
│ irreversible!                    │
│                                  │
│ Data to be deleted:              │
│ • Profile information            │
│ • Applications                   │
│ • Assessment records             │
│ • Messages (kept for audit)      │
│                                  │
│ Keep data for auditing:          │
│ ☑ Yes (recommended)              │
│                                  │
│ [Delete Account] [Cancel]        │
└──────────────────────────────────┘
```

### 4. Send Messages & Notifications

```
┌──────────────────────────────────────┐
│ Send Message to Users                │
├──────────────────────────────────────┤
│ Recipients: [Select ▼]               │
│ • Candidate with Trust Score < 50    │
│ • Users from Mumbai                  │
│ • Recent signups (last 7 days)      │
│                                      │
│ To: 245 candidates selected          │
│                                      │
│ Subject: [________________]          │
│                                      │
│ Message:                             │
│ [____________________________]        │
│ [____________________________]        │
│                                      │
│ Delivery:                            │
│ ☑ In-app notification                │
│ ☑ Email                              │
│ ☐ SMS                                │
│                                      │
│ Schedule: [Now ▼] or [Date/Time]    │
│                                      │
│ [Send] [Preview] [Cancel]            │
└──────────────────────────────────────┘
```

### 5. User Analytics

#### User Metrics Dashboard
```
┌────────────────────────────────────────┐
│ User Analytics (April 2026)            │
├────────────────────────────────────────┤
│ Total Users: 5,432                     │
│ Active This Month: 2,145 (40%)         │
│ New Signups: 234 (+12% vs last month) │
│                                        │
│ By Role:                               │
│ • Candidates: 4,200 (77%)             │
│ • Recruiters: 1,232 (23%)             │
│                                        │
│ Engagement:                            │
│ • Daily Active: 567 (10.4%)           │
│ • Weekly Active: 1,456 (27%)          │
│ • Monthly Active: 2,145 (39%)         │
│                                        │
│ Churn Rate: 2.3% (users leaving)      │
│ Retention: 97.7% (month-over-month)   │
│                                        │
│ Verification Status:                   │
│ • Fully Verified: 3,654 (67%)        │
│ • Partially Verified: 1,234 (23%)    │
│ • Not Verified: 544 (10%)            │
│                                        │
│ [Download Report] [View Charts]       │
└────────────────────────────────────────┘
```

---

## 📦 Bulk Upload Management

### 1. View All Uploads

```
┌──────────────────────────────────────────┐
│ Bulk Upload History                      │
├──────────────────────────────────────────┤
│ Filter: Status [All ▼]  Date [This month]│
│                                          │
│ Upload Date | Source | Count | Status   │
│ Apr 1       | CSV-01 | 450   | ✅ Done  │
│ Mar 28      | CSV-02 | 320   | ✅ Done  │
│ Mar 25      | CSV-03 | 680   | ⏳ Review│
│ Mar 20      | CSV-04 | 200   | ❌ Error │
│                                          │
│ [Upload New] [View Details] [Export]    │
└──────────────────────────────────────────┘
```

### 2. Initiate New Upload

#### Upload Wizard

```
STEP 1: Select Files
┌──────────────────────────────────┐
│ Step 1 of 4: Upload Files        │
├──────────────────────────────────┤
│ CSV File: [Choose File]          │
│ [candidates.csv]                 │
│                                  │
│ Resume Files (ZIP):              │
│ [Choose File]                    │
│ [resumes.zip]                    │
│                                  │
│ [Next] [Cancel]                  │
└──────────────────────────────────┘

STEP 2: Data Validation

System validates:
✅ CSV format correct
✅ 450 records found
✅ Resumes: 420 matched, 30 missing
⚠️ 15 email format issues (need review)
✅ No viruses detected

STEP 3: Duplicate Detection

Found potential duplicates:
• Same name + email: 5 candidates
• Similar name + email: 12 candidates
• Resume hash match: 3 candidates

Admin can:
[Mark as New] [Mark as Duplicate] 
[Mark as Manual Review]

STEP 4: Review & Import

┌──────────────────────────────────┐
│ Step 4: Confirm Import           │
├──────────────────────────────────┤
│ Total to Import: 450             │
│ New Candidates: 432              │
│ Duplicates (skip): 18            │
│ Email Issues (manual): 0         │
│                                  │
│ Auto-Invitation: Send OTP emails │
│                                  │
│ [Start Import]                   │
└──────────────────────────────────┘
```

### 3. Review Duplicate Candidates

```
┌─────────────────────────────────────────┐
│ Review Duplicates (15 candidates)       │
├─────────────────────────────────────────┤
│                                         │
│ Name: Rajesh Kumar                      │
│ ─────────────────────────────────────   │
│                                         │
│ NEW CANDIDATE:                          │
│ Email: raj@newmail.com                  │
│ Resume: resume-new.pdf                  │
│ [View Resume]                           │
│                                         │
│ VS                                      │
│                                         │
│ EXISTING CANDIDATE (ID: 1234):          │
│ Email: raj.kumar@oldmail.com            │
│ Resume: resume-old.pdf                  │
│ Joined: Mar 2026                        │
│ [View Profile]                          │
│                                         │
│ Decision:                               │
│ ○ Keep both (new & old)                │
│ ○ Skip new (keep old)                  │
│ ◉ Mark new as update to old            │
│ ○ Manual review needed                 │
│                                         │
│ [Previous] [Next] [Submit Decisions]   │
└─────────────────────────────────────────┘
```

### 4. Monitor Upload Progress

```
┌──────────────────────────────────┐
│ Import In Progress               │
├──────────────────────────────────┤
│ Processing upload_id: 789        │
│                                  │
│ ████████████░░░░░░ 60%           │
│                                  │
│ Processed: 270 / 450             │
│ Time Elapsed: 45 seconds         │
│ Est. Time Remaining: 30 seconds  │
│                                  │
│ Current Step:                    │
│ Parsing resume_270.pdf...        │
│                                  │
│ Status Log:                      │
│ ✅ 250 candidates created       │
│ ✅ 20 profiles updated          │
│ ⏳ 180 pending email send        │
│ ❌ 3 errors (see details)       │
│                                  │
│ [Pause] [Cancel] [View Errors]  │
└──────────────────────────────────┘
```

### 5. Upload Completion & Summary

```
┌────────────────────────────────────┐
│ Upload Complete ✅                 │
├────────────────────────────────────┤
│ Upload ID: upload_789              │
│ Date: Apr 2, 2026, 3:45 PM        │
│                                    │
│ Summary:                           │
│ Total Uploaded: 450                │
│ New Candidates: 420                │
│ Updated Profiles: 15               │
│ Duplicates (skipped): 15           │
│                                    │
│ Processing Status:                 │
│ ✅ Resumes parsed successfully    │
│ ✅ 415 OTP emails sent            │
│ ✅ 5 emails failed (will retry)   │
│ ✅ Skills normalized              │
│                                    │
│ Data Quality:                      │
│ Average profile completion: 65%    │
│ Resumes recovered: 420/450 (93%)  │
│                                    │
│ Errors (3 total):                  │
│ • Email invalid: 2                 │
│ • Resume corrupt: 1                │
│                                    │
│ [Download Report] [View Errors]   │
│ [Create Job Matching] [Done]       │
└────────────────────────────────────┘
```

---

## ⚙️ Platform Settings

### 1. General Settings

```
┌──────────────────────────────────────┐
│ Platform Settings                    │
├──────────────────────────────────────┤
│ Platform Name: [TalentFlow]         │
│ Tagline: [Verified Talent...]       │
│                                      │
│ Maintenance Mode: [Toggle]          │
│ Status Messages:                    │
│ [Maintenance in progress...]        │
│                                      │
│ Time Zone: [Asia/Kolkata ▼]         │
│ Currency: [INR ▼]                   │
│ Language: [English ▼]                │
│                                      │
│ [Save Changes]                       │
└──────────────────────────────────────┘
```

### 2. Assessment Configuration

```
┌──────────────────────────────────────┐
│ Assessment Settings                  │
├──────────────────────────────────────┤
│                                      │
│ Default Levels:                      │
│ ☑ FRESHER  ☑ MID  ☑ SENIOR ☑ LEAD │
│                                      │
│ Questions Per Assessment:            │
│ Minimum: [6] Maximum: [16]          │
│                                      │
│ Passing Score By Level:              │
│ • FRESHER: [50]%                    │
│ • MID: [60]%                        │
│ • SENIOR: [70]%                     │
│ • LEADERSHIP: [65]%                 │
│                                      │
│ Retry Policy:                        │
│ Days between retries: [30]          │
│ Max retries per level: [3]          │
│                                      │
│ Anti-Cheat:                         │
│ ☑ Tab-switch detection              │
│ ☑ Screenshot prevention              │
│ Tab violations to ban: [3]          │
│                                      │
│ Certificate Validity: [6] months     │
│                                      │
│ [Save Changes]                       │
└──────────────────────────────────────┘
```

### 3. Email & Notification Templates

```
┌──────────────────────────────────────┐
│ Email Templates                      │
├──────────────────────────────────────┤
│ Select Template:                     │
│ [Welcome Email ▼]                   │
│ [OTP Verification]                   │
│ [Interview Invite]                   │
│ [Offer Notification]                 │
│ [Password Reset]                     │
│                                      │
│ Template: Welcome Email             │
│ Subject: [Welcome to TalentFlow!]   │
│                                      │
│ Body: [________________________]      │
│       [________________________]      │
│       [Insert Variables:]            │
│       {{candidate_name}}             │
│       {{platform_url}}               │
│       {{support_email}}              │
│                                      │
│ Preview: [Show preview email]        │
│ [Save] [Reset to Default]            │
└──────────────────────────────────────┘
```

### 4. API & Integration Settings

```
┌──────────────────────────────────────┐
│ API & Integrations                   │
├──────────────────────────────────────┤
│                                      │
│ Gemini API Key:                      │
│ [•••••••••••••••••••••••••]          │
│ Status: ✅ Connected                 │
│ [Refresh] [Test Connection]         │
│                                      │
│ Groq API Key:                        │
│ [•••••••••••••••••••••••••]          │
│ Status: ✅ Connected                 │
│                                      │
│ AWS S3:                              │
│ Region: [ap-south-1]                │
│ Bucket: [talentflow-files]          │
│ Status: ✅ Connected                 │
│ [Test Upload]                        │
│                                      │
│ AWS SES:                             │
│ Region: [ap-south-1]                │
│ Status: ✅ Connected                 │
│ Daily Quota: 50,000 emails          │
│ Used Today: 1,234 emails            │
│                                      │
│ [Save] [Verify All]                  │
└──────────────────────────────────────┘
```

---

## 📊 Analytics & Reports

### 1. Platform Overview Dashboard

```
┌────────────────────────────────────────┐
│ Platform Analytics Dashboard           │
├────────────────────────────────────────┤
│ Period: [Apr 1 - Apr 2, 2026]         │
│                                        │
│ KEY METRICS:                           │
│ Total Users: 5,432 (+2.1% vs last mo)│
│ Active Users (7-day): 1,456            │
│ New Signups: 45 (+10% vs last day)    │
│ Jobs Posted: 234                      │
│ Applications: 1,245                    │
│ Hires Completed: 12                   │
│ Assessment Taken: 89                  │
│                                        │
│ ENGAGEMENT:                            │
│ • Page Views: 45,234                  │
│ • Session Avg Duration: 12 min        │
│ • Bounce Rate: 18%                    │
│                                        │
│ REVENUE (if applicable):               │
│ • Premium Users: 234                  │
│ • MRR: ₹45,000                        │
│                                        │
│ SYSTEM:                                │
│ • API Response Time: 145ms avg        │
│ • Error Rate: 0.02%                   │
│ • Uptime: 99.95%                      │
│                                        │
│ [Download Report] [View Charts]       │
└────────────────────────────────────────┘
```

### 2. User Growth Report

```
Charts showing:
- New users trend (line chart)
- Active users trend (area chart)
- Signups by role (pie chart)
- Churn analysis (funnel)
- Geographic distribution (map)
```

### 3. Hiring Pipeline Report

```
Metrics:
- Total applications: 10K
- Shortlist rate: 28%
- Interview conversion: 15%
- Offer rate: 8%
- Hire conversion: 6.7%
- Average time-to-hire: 18 days
- Most hired roles: React Developer, Backend Dev, DevOps
```

---

## 🖥️ System Configuration

### 1. Database Maintenance
```
• Backup Status: ✅ Last backup Apr 2, 1 AM
• Database Size: 45 GB
• Connections: 234 active
• Slow Queries: 12 flagged (> 1s)
• Disk Usage: 78% (critical threshold: 90%)
```

### 2. Server Health
```
• CPU Usage: 45%
• Memory Usage: 62%
• Disk Space: 250 GB free
• Network: 12 Mbps bandwidth avg
• API Latency: 145ms avg
• Error Rate: 0.02%
```

### 3. Security Snapshot
```
• Firewall Status: ✅ Active
• SSL Certificate: ✅ Valid (expires Dec 2026)
• Failed Login Attempts (24h): 45
• Suspended Accounts: 12
• Fraud Flags: 1 (under review)
```

---

## 🔍 Monitoring & Maintenance

### 1. Activity Logging

Admin can view:
- User login/logout history
- API calls and endpoints accessed
- Data modifications (who changed what, when)
- Failed authentication attempts
- Suspicious activity alerts

### 2. System Alerts & Monitoring

```
┌──────────────────────────────────────┐
│ System Alerts                        │
├──────────────────────────────────────┤
│ 🔴 CRITICAL:                         │
│ • Disk space at 89% (1.5 hrs ago)   │
│   Action taken: Cleanup job ran     │
│   Status: ✅ Resolved               │
│                                      │
│ 🟡 WARNING:                          │
│ • API error rate spike at 0.5%      │
│ • Database slow queries (18 total)  │
│                                      │
│ ℹ️ INFO:                             │
│ • Backup completed successfully     │
│ • Email quota at 78% (28,000/50k)   │
│                                      │
│ [View All Logs] [Configure Alerts]  │
└──────────────────────────────────────┘
```

### 3. Manual Interventions

Admin can:
- **Force sync** - Manually trigger data synchronization
- **Clear cache** - Reset caching layers
- **Reprocess** - Reprocess failed bulk uploads
- **Generate reports** - On-demand reports
- **Send broadcasts** - Message all users
- **Modify settings** - Real-time configuration changes

---

## 🔐 Admin Security

### 1. Admin Access Control
- IP Whitelisting (optional)
- Enforce 2FA (Two-Factor Authentication)
- Audit all admin actions
- Session timeout: 30 minutes of inactivity
- Log all configuration changes

### 2. Data Privacy
- Admin can download but cannot permanently delete data
- All data access is logged
- Sensitive data (passwords) never displayed
- PII exports require approval

---

## 📝 Conclusion

The Admin Dashboard provides complete platform control:
- ✅ Full user management capabilities
- ✅ Bulk import automation
- ✅ System configuration and tuning
- ✅ Comprehensive analytics
- ✅ Security and compliance tools
- ✅ Monitoring and alerting

All features are designed for ease of use and safety, with multiple confirmations for destructive actions.
