# Hiring Pool Page - Sidebar Reintegration Guide

## Overview
The "Candidate Pool" page has been **temporarily removed from the recruiter sidebar** as of April 18, 2026. The page logic and functionality remain fully intact and can be easily reintegrated in the future.

## Page Details

### URL
- **Route**: `http://localhost:3000/dashboard/recruiter/hiring/pool`
- **File Location**: `/apps/web/src/app/dashboard/recruiter/hiring/pool/page.tsx`

### Page Functionality
- Displays a grid of verified candidates from the database
- Features CRO (Career Readiness Optimization) badges showing candidate urgency and readiness
- Includes candidate profile viewing, invitation functionality, and messaging capability
- Integrates with team distribution and candidate filtering
- Uses identity verification badges and trust scoring

### Key Features
- ✅ Candidate card display with profile photos, roles, and experience
- ✅ CRO status tracking (Ready Now, Actively Looking, Passive)
- ✅ Trust scoring and experience-based filtering
- ✅ Invite modal for job opportunities
- ✅ Direct messaging functionality
- ✅ Profile modal viewing with resume and experience details
- ✅ Privacy controls (name blurring for non-engaged candidates)
- ✅ Experience band filtering (Fresher, Mid, Senior, Leadership)
- ✅ Search and sorting capabilities

## Reintegration Steps

### 1. **Add Back to Sidebar** (RecruiterSidebar.tsx)

**File**: `/apps/web/src/components/RecruiterSidebar.tsx`

**Location**: Find the "Talent Hub" section (around line 113-130)

**Add this item back** to the `items` array under "Talent Hub":

```javascript
{
  label: "Candidate Pool",
  href: "/dashboard/recruiter/hiring/pool",
  icon: <UsersRound className="h-4 w-4" />,
  locked: isLocked,
  description: "Access to the global database of verified talent",
},
```

**Position**: Should be placed AFTER "Talent Pool" and BEFORE "Recommended"

### 2. **Updated Sidebar Code Reference**

The complete "Talent Hub" section after reintegration should look like:

```javascript
{
  label: "Talent Hub",
  icon: <Users className="h-4 w-4" />,
  items: [
    {
      label: "Talent Pool",
      href: "/dashboard/recruiter/talent-pool",
      icon: <Globe className="h-4 w-4" />,
      locked: isLocked,
      description: "Visualized view of total verified candidates",
    },
    {
      label: "Candidate Pool",  // ← ADD THIS BACK
      href: "/dashboard/recruiter/hiring/pool",
      icon: <UsersRound className="h-4 w-4" />,
      locked: isLocked,
      description: "Access to the global database of verified talent",
    },
    {
      label: "Recommended",
      href: "/dashboard/recruiter/intelligence/recommendations",
      icon: <Zap className="h-4 w-4" />,
      locked: isLocked,
    },
  ],
},
```

### 3. **Verify Dependencies**

Ensure these imports exist in `RecruiterSidebar.tsx`:
- ✅ `UsersRound` from lucide-react (should already be imported)
- ✅ `Globe` from lucide-react (for Talent Pool icon)
- ✅ `Users` from lucide-react (for Talent Hub section icon)

All icons are already imported, so no additional imports needed.

## Future Enhancements to Consider

When reintegrating, you may also want to:

1. **Add feature flag**: If the page is incomplete or in beta, consider adding a feature flag to control visibility
2. **Update lock status**: The page is locked when `isLocked = profileScore === 0`. This can be customized based on future requirements
3. **Add analytics**: Track user access to understand feature adoption
4. **Performance optimization**: Consider pagination if the candidate list grows large

## Testing After Reintegration

After adding the sidebar link back:

1. ✅ Verify the link appears in the sidebar under "Talent Hub"
2. ✅ Click the link and confirm the page loads correctly
3. ✅ Test that the page respects the lock status (hidden when `isLocked = true`)
4. ✅ Confirm all filtering, sorting, and interaction features work
5. ✅ Verify privacy controls are still active (names blurred for non-engaged candidates)
6. ✅ Test candidate invitation and messaging flows

## Files NOT Deleted

All page logic and functionality files remain intact:

- `/apps/web/src/app/dashboard/recruiter/hiring/pool/page.tsx` ✅ EXISTS
- `/apps/web/src/components/CandidateProfileModal.tsx` ✅ EXISTS
- `/apps/web/src/components/JobInviteModal.tsx` ✅ EXISTS
- All API endpoints in backend ✅ FUNCTIONAL

## Contact & Notes

- **Removal Date**: April 18, 2026
- **Reason**: Future integration planned
- **Status**: Page is stable and fully functional, just hidden from navigation
- **Backend**: No API changes needed, all endpoints remain available

---

**To restore**: Follow the "Reintegration Steps" above. Should take less than 2 minutes.
