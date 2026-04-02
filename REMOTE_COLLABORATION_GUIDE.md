# Remote Collaboration & CI/CD Setup Guide

## Overview
This guide explains how to set up your TALENTFLOW project for remote collaboration with your friend on the frontend using GitHub Actions CI/CD.

---

## **Part 1: GitHub Repository Setup**

### Step 1a: Add your friend as a collaborator
1. Go to your GitHub repo → **Settings** → **Collaborators**
2. Add their GitHub username
3. They'll receive an invite email

### Step 1b: Set up branch protection rules
1. Go to **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ "Require a pull request before merging"
   - ✅ "Require status checks to pass before merging"
   - ✅ "Require branches to be up to date before merging"
4. Save

---

## **Part 2: Frontend Development Workflow**

### For your friend (contributor):

#### 1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/TALENTFLOW.git
cd TALENTFLOW
```

#### 2. **Set up Node.js environment**
```bash
# Make sure Node.js 18+ is installed
node --version

# Install frontend dependencies
cd apps/web
npm install
```

#### 3. **Create a feature branch**
```bash
# Create branch for their work
git checkout -b feature/their-feature-name
# Example: feature/user-dashboard, feature/job-filters, etc.
```

#### 4. **Make changes and commit**
```bash
# Make their code changes...

# Test locally
npm run dev           # Run development server
npm run lint          # Check code style
npm run build         # Test production build

# Stage and commit
git add apps/web/...
git commit -m "feat: Add job filtering component"
```

#### 5. **Push and create Pull Request**
```bash
git push origin feature/their-feature-name
```
- Go to GitHub and click "Create Pull Request"
- Add description of changes
- Submit PR

#### 6. **CI/CD Pipeline runs automatically**
✅ GitHub Actions will:
- Lint code
- Build the project
- Run on multiple Node.js versions
- Post results on the PR

**All checks must pass before merging!**

#### 7. **Code review and merge**
- You review their code
- Approve and merge (or request changes)
- CI/CD automatically deploys to production

---

## **Part 3: CI/CD Platform Configuration**

### GitHub Actions (Already set up in `.github/workflows/`)

#### Current Workflows:

1. **frontend-ci.yml** ✅
   - Triggers on: Pull requests to `apps/web/**`
   - Runs: Linting, building
   - Runs on: Node 18.x and 20.x

2. **frontend-deploy.yml** ⚙️
   - Triggers on: Push to `main`
   - Needs: Deployment configuration (see below)

---

## **Part 4: Configure Deployment**

Choose your deployment platform and follow the steps:

### **Option A: Vercel (Recommended for Next.js)**
1. Sign up at [vercel.com](https://vercel.com)
2. Connect GitHub repo
3. Set environment variables in Vercel dashboard
4. Generate Vercel token: Account → Settings → Tokens
5. Add to GitHub:
   ```
   Settings → Secrets and variables → Actions → New repository secret
   VERCEL_TOKEN: (your token)
   VERCEL_ORG_ID: (from Vercel)
   VERCEL_PROJECT_ID: (from Vercel)
   ```
6. Uncomment Vercel section in `frontend-deploy.yml`

### **Option B: Netlify**
1. Sign up at [netlify.com](https://netlify.com)
2. Connect GitHub repo
3. Site settings → API → Create access token
4. Add to GitHub Secrets:
   ```
   NETLIFY_AUTH_TOKEN: (your token)
   NETLIFY_SITE_ID: (your site ID)
   ```
5. Uncomment Netlify section in `frontend-deploy.yml`

### **Option C: AWS (S3 + CloudFront)**
1. Create S3 bucket and CloudFront distribution
2. Generate AWS IAM credentials with S3 access
3. Add to GitHub Secrets:
   ```
   AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY
   AWS_S3_BUCKET
   ```
4. Uncomment AWS section in `frontend-deploy.yml`

---

## **Part 5: GitHub Secrets Setup**

To securely pass credentials to CI/CD:

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each secret (e.g., `VERCEL_TOKEN`, `NETLIFY_AUTH_TOKEN`)
4. Reference in workflows as `${{ secrets.SECRET_NAME }}`

---

## **Part 6: Daily Development Workflow**

### You (Project Owner):
```bash
# Keep main branch up to date
git checkout main
git pull origin main

# Review pull requests
# Click "Review changes" on GitHub
# Approve or request changes

# Merge approved PRs
# Automatically deploys to production
```

### Your Friend (Contributor):
```bash
# Keep changes up to date
git fetch origin
git rebase origin/main

# Push updates
git push origin feature/their-feature-name --force-with-lease

# Wait for CI/CD to pass
# Then you can review and merge
```

---

## **Part 7: Monitoring & Troubleshooting**

### View CI/CD Status
- Go to GitHub repo → **Actions** tab
- See all workflow runs
- Click on failed run to see error logs

### Common Issues:

**❌ "Build failed"**
- Check the log in Actions tab
- Fix locally first: `npm install`, `npm run build`
- Push fix to same branch
- CI/CD reruns automatically

**❌ "Lint failed"**
- Run locally: `npm run lint`
- Fix ESLint errors
- Commit and push

**❌ "Tests failed"**
- Run tests locally
- Fix and push again

---

## **Part 8: Best Practices**

✅ **Do:**
- Create descriptive branch names: `feature/job-search`, `fix/filter-bug`
- Write clear commit messages
- Keep PRs focused and small
- Test locally before pushing
- Let CI/CD pass before reviewing

❌ **Don't:**
- Push directly to `main` (blocked by branch protection)
- Merge without CI/CD passing
- Ignore linting errors
- Create huge PRs with many changes

---

## **Quick Reference: Git Commands**

```bash
# Clone repo
git clone https://github.com/YOUR/REPO.git

# Create feature branch
git checkout -b feature/name

# Make changes
git add apps/web/...
git commit -m "feat: description"

# Push to remote
git push origin feature/name

# Update from main
git fetch origin
git rebase origin/main

# Check status
git status
git log --oneline
```

---

## **Environment Variables**

Create `.env.local` in `apps/web/` for local development:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## **Support & Troubleshooting**

1. **GitHub Issues**: Use GitHub Issues for bugs/features
2. **PR Comments**: Comment on specific code lines during review
3. **Discord/Slack**: For quick questions (if available)
4. **Documentation**: Check existing docs in `/docs` folder

---

## **Next Steps**

1. ✅ Add your friend as a collaborator on GitHub
2. ✅ They clone the repo and set up locally
3. ✅ They create a feature branch
4. ✅ They make changes and push
5. ✅ You review the PR
6. ✅ CI/CD automatically deploys when merged
7. ✅ Repeat!

---

**Happy collaborating! 🚀**
