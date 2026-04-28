# Back Button & Session Management Issues Identified

## Issue 1: Unexpected Auto-Redirect on Back Button
**Location:** `signup/page.tsx` and `login/page.tsx` - checkSession()
**Problem:**
```typescript
if (token) {
  router.replace(handshake.next_step);  // ← Redirects away silently
}
```
- When user presses back while logged in, the checkSession() effect runs
- It finds the token and auto-redirects them away from login/signup
- User cannot intentionally stay on login/signup page if they're logged in
- **Expected:** Should only redirect if NOT on login/signup by mistake

## Issue 2: Effect Re-runs on State Changes
**Location:** Both login and signup pages - useEffect dependency
**Problem:**
```typescript
useEffect(() => {
  if (state === "INITIAL" && !initialized.current) {
    initialized.current = true;
    checkSession().then(() => { ... });
  }
}, [state, role, router, searchParams]);  // ← state is in dependency!
```
- `state` changes during initialization (INITIAL → AWAITING_EMAIL/PASSWORD_SET)
- This causes the useEffect to run again after state changes
- Even though `initialized.current` prevents running twice, it's fragile
- **Expected:** Effect should only run once on mount, not on state changes

## Issue 3: sessionStorage Not Properly Preserved on Back
**Location:** `signup/page.tsx` - Save/restore state
**Problem:**
- sessionStorage is cleared when you navigate to a different page
- On browser back, sessionStorage is restored from browser cache
- BUT the restoration timing is unpredictable
- Password setup messages might show stale data or be missing
- **Expected:** Should distinguish between intentional navigation vs back button

## Issue 4: URL Parameters Confusion on Back
**Location:** Both pages - searchParams handling
**Problem:**
```typescript
const emailParam = searchParams.get("email");  // ← May have stale value
if (emailParam) {
  window.history.replaceState({}, "", ...);   // ← Tries to clean but too late
}
```
- When user goes from signup back to login, URL params might stick
- Or when going from login back to home
- Causes wrong initial state on page reload
- **Expected:** URL params should be cleaned properly before back navigation

## Issue 5: Router.replace() Conflicts with Browser Back
**Location:** checkSession() in both pages
**Problem:**
```typescript
router.replace(handshake.next_step);  // ← Navigates programmatically
```
- User presses back → checkSession() runs → router.replace() navigates programmatically
- This can interfere with browser history
- Creates confusing back button behavior (sometimes forward, sometimes backward)
- **Expected:** Browser back should follow natural history, not be overridden

## Issue 6: Initialized Flag Not Session-Aware
**Location:** signup/page.tsx - initialized.current
**Problem:**
```typescript
const initialized = useRef(false);  // ← Once set, never resets
if (state === "INITIAL" && !initialized.current) {
  initialized.current = true;
  // ...
}
```
- If you go back to signup from another page, `initialized.current` is still true
- The checkSession() logic doesn't run again
- Session state might be stale from before
- **Expected:** Should detect when user truly returns to the page fresh

## Issue 7: Token Auto-Redirect Shouldn't Happen on Auth Pages
**Location:** login/page.tsx and signup/page.tsx
**Problem:**
- If user has a token and visits /login or /signup, they're auto-redirected
- But what if they WANT to logout and re-signup?
- Or re-login with a different account?
- They can't without clearing localStorage first
- **Expected:** Should allow intentional re-auth flows

## Summary of Back Button Issues
1. ❌ Auto-redirect prevents intentional back navigation
2. ❌ Effect runs multiple times (fragile pattern)
3. ❌ sessionStorage restoration timing unpredictable
4. ❌ URL params cause confusion
5. ❌ router.replace() interferes with browser history
6. ❌ State initialization not page-visit aware
7. ❌ Logged-in users can't re-auth on login/signup pages

## Recommended Fixes
1. **Detect browser back** - Don't auto-redirect on back button, let user choose
2. **Run initialization once per page load** - Not per state change
3. **Explicit session checks** - Only redirect if truly not supposed to be on page
4. **URL param cleanup** - Clear after processing, before history update
5. **Skip redirect on auth pages** - Allow intentional login/signup even if logged in
6. **Preserve navigation intent** - Distinguish back button from programmatic navigation
