# CI/CD Troubleshooting Guide

## Common Issues & Solutions

### 🔴 Build Fails - "Cannot find module"

**Problem:** CI/CD error: `Error: Cannot find module 'xyz'`

**Solutions:**
1. Check if the package is in `package.json`:
   ```bash
   cd apps/web
   npm list xyz
   ```
2. If missing, install it:
   ```bash
   npm install xyz
   ```
3. Commit and push:
   ```bash
   git add package.json package-lock.json
   git commit -m "fix: add missing dependency"
   git push origin feature/name
   ```

---

### 🟡 Lint Fails - ESLint Errors

**Problem:** CI/CD fails with lint errors

**Solution:**
1. Run locally first:
   ```bash
   cd apps/web
   npm run lint
   ```
2. Fix errors in your code
3. If auto-fixable:
   ```bash
   npm run lint -- --fix
   ```
4. Commit and push:
   ```bash
   git add .
   git commit -m "fix: resolve lint errors"
   git push origin feature/name
   ```

---

### ❌ Build Succeeds Locally but Fails in CI/CD

**Problem:** Works on my computer but fails on GitHub Actions

**Common Causes:**
1. **Different Node version**
   - Check your local Node version: `node --version`
   - CI/CD uses 18.x and 20.x
   - Update your local Node if too old

2. **Missing .gitignore entries**
   - Make sure `.next` is NOT in git
   - Make sure `node_modules` is NOT in git
   - Should only commit source code

3. **Environment variables**
   - CI/CD doesn't have `.env.local`
   - Add default values to code or use GitHub Secrets

4. **Platform differences** (Windows vs Linux)
   - Use `/` for paths, not `\`
   - Avoid Windows-specific commands

---

### 🔐 Deployment Fails - "401 Unauthorized"

**Problem:** Deploy step fails with auth error

**Solution:**
1. Check GitHub Secrets are set:
   - Go to repo → Settings → Secrets and variables → Actions
   - Verify all required secrets are present

2. Verify token is valid:
   - Regenerate token in your deployment platform
   - Update GitHub Secret

3. Check secret names match workflow:
   - In `frontend-deploy.yml`, look for `${{ secrets.XXXX }}`
   - Make sure GitHub secret name matches exactly (case-sensitive)

Example:
```yml
# GitHub Secrets should have these names for Vercel:
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

---

### 🚫 "Repository not found" Error

**Problem:** GitHub Actions can't access deployment platform

**Causes & Fixes:**
1. **Wrong credentials** - Regenerate and update GitHub Secrets
2. **Expired token** - Create new token and update
3. **Missing permissions** - Token needs correct access level
4. **Project ID wrong** - Double-check project ID in secrets

---

### ⏱️ Build Timeout

**Problem:** CI/CD kills job after 6 hours (GitHub Actions timeout)

**Causes:**
- `npm install` taking too long
- Build process stuck

**Solution:**
1. Add `.npmrc` to speed up npm:
   ```
   registry=https://registry.npmjs.org/
   prefer-offline=true
   audit=false
   ```
2. Use npm ci instead of npm install (faster):
   - Already done in workflows ✓

3. Check for large files that slow build:
   ```bash
   npm ls --depth=0
   ```

---

### 📦 "Peer dependency warning"

**Problem:** CI/CD shows warnings about peer dependencies

**This is OK!** Warnings don't fail the build. If you want to fix:
```bash
npm install --save-peer-deps-from-npm6
```

---

### 🔄 PR Shows "Some checks are pending" for Hours

**Problem:** CI/CD seems stuck

**Solution:**
1. Check **Actions** tab to see workflow status
2. If stuck, contact GitHub Support
3. Manual workaround: Re-run job
   - Click on failed workflow in Actions tab
   - Click "Re-run failed jobs"

---

### ❓ CI/CD Not Running at All

**Problem:** No workflows showing in Actions tab

**Causes & Solutions:**

1. **No `.github/workflows/` folder**
   - Should exist with `.yml` files
   - Check it's committed to main branch

2. **Workflow file has syntax error**
   - Check YAML syntax (indentation matters!)
   - Preview: https://github.com/YOUR/REPO/actions/new

3. **Trigger not matching**
   - PR must be to `apps/web/**` path
   - OR to `main` branch for deploy

4. **Tests passing silently**
   - Check "Details" link on commit to see full output

---

### 💾 "Changes not deploying"

**Problem:** Merged PR but changes not live

**Checklist:**
1. Did PR actually merge? Check git log
2. Did deploy workflow run? Check Actions tab
3. Did deploy step succeed? Check workflow logs
4. Is cache stale? Clear cache in deployment platform
5. DNS propagation? Can take up to 5 minutes

---

### 🔗 Deployment URL Shows Old Version

**Problem:** Deployed but seeing old code on live website

**Solutions:**
1. **Hard refresh browser:**
   - Ctrl+Shift+R (Windows)
   - Cmd+Shift+R (Mac)

2. **Clear CDN cache:**
   - Go to Vercel/Netlify/AWS dashboard
   - Find "Clear Cache" option
   - Click it

3. **Check deployment actually finished:**
   - Check GitHub Actions workflow completed
   - Check deployment platform dashboard

---

## 🐛 Debug Workflow

When something fails:

1. **Check GitHub Actions log:**
   - Go to Actions tab
   - Click failed workflow
   - Expand step that failed
   - Read error message carefully

2. **Reproduce locally:**
   ```bash
   cd apps/web
   npm ci  # Clean install, like CI does
   npm run build
   npm run lint
   ```

3. **Check git status:**
   ```bash
   git status
   git log --oneline -5
   ```

4. **Update and retry:**
   ```bash
   git fetch origin
   git rebase origin/main
   git push origin feature/name
   ```

---

## 📞 Getting Help

If stuck:

1. **Check this guide** - Most issues are here
2. **Read workflow logs** - GitHub Actions is very detailed
3. **Search GitHub Issues** - Someone likely had it before
4. **Ask in PR comments** - I can help debug
5. **Check platform docs:**
   - Vercel: https://vercel.com/docs
   - Netlify: https://docs.netlify.com
   - AWS: https://docs.aws.amazon.com

---

## Quick Commands Reference

```bash
# Test build locally
npm install
npm run build

# Test lint locally  
npm run lint

# Update from main
git fetch origin
git rebase origin/main

# Force push after rebase
git push origin feature/name --force-with-lease

# Check recent commits
git log --oneline -10

# See what changed
git diff origin/main
```

---

**Don't panic - CI/CD failures are normal and usually easy to fix!** 💪
