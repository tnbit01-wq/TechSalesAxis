# Quick Reference Card

## Files Location

```
src/config/landingPageData.ts      ← Edit this to change content
src/config/validation.ts            ← Config validation
src/components/landing/             ← All components
```

## Quick Commands

### Edit Configuration
```ts
// File: src/config/landingPageData.ts
// Change any value in defaultLandingPageConfig
hero: { heading: "New Heading" }
```

### Use in Component
```tsx
import { LandingPageTemplate } from '@/components/landing';
import { defaultLandingPageConfig } from '@/config';

<LandingPageTemplate config={defaultLandingPageConfig} brandName="TalentFlow" brandMark="T" />
```

### Validate Config
```ts
import { validateLandingPageConfig } from '@/config';
const { valid, errors } = validateLandingPageConfig(config);
```

## Configuration Sections

| Section | Location | What to Edit |
|---------|----------|--------------|
| Navigation | `config.navigation` | Links, buttons |
| Hero Banner | `config.hero` | Heading, description |
| Trust Badges | `config.trustBadges` | Trust items |
| Features | `config.features.cards` | Feature list |
| Candidates | `config.candidates` | Candidate section content |
| Recruiters | `config.recruiters` | Recruiter section content |
| Bidirectional | `config.bidirectional` | Bidirectional features |
| CTA | `config.cta` | Call-to-action section |
| Footer | `config.footer` | Footer links & info |

## Common Edits

### Change Button Text
```ts
// File: src/config/landingPageData.ts
cta: {
  buttons: [
    { label: "New Button Text", href: "#", variant: "white" }
  ]
}
```

### Add Feature Card
```ts
features: {
  cards: [
    // ... existing cards
    {
      icon: '🚀',
      title: 'New Feature',
      description: 'Description here'
    }
  ]
}
```

### Update Navigation
```ts
navigation: {
  links: [
    { label: 'New Link', href: '#section' },
    // ...
  ]
}
```

### Change Statistics
```ts
heroStats: [
  { value: '99%', label: 'New Stat' },
  // ...
]
```

## Validation

```ts
import { 
  validateLandingPageConfig,      // Check if config is valid
  debugConfig,                      // Print detailed info
  countConfigItems,                 // Count items
  getMissingFields                  // Get errors
} from '@/config';
```

## Component Props

### LandingPageTemplate
```tsx
<LandingPageTemplate 
  config={LandingPageConfig}
  brandName="string"
  brandMark="string"
/>
```

### Individual Sections
```tsx
<Navigation links={[]} actions={[]} brandName="" brandMark="" />
<HeroSection content={{}} trustBadges={[]} stats={[]} ctaText="" ctaHref="" />
<FeaturesSection sectionLabel="" heading="" subheading="" cards={[]} />
<CandidatesSection sectionLabel="" heading="" ... />
<RecruitersSection sectionLabel="" heading="" ... />
<BidirectionalSection sectionLabel="" heading="" features={[]} />
<CtaSection heading="" description="" stats={[]} buttons={[]} />
<Footer brandMark="" brandName="" ... />
```

## TypeScript Types

```ts
LandingPageConfig         // Main config
NavLink                   // Nav item
NavAction                 // Nav button
HeroContent              // Hero section
FeatureCard              // Feature item
JobCard                  // Job listing
StatItem                 // Statistic
TrustBadge               // Trust item
CandidateSpotlight       // Featured candidate
FooterColumn              // Footer column
```

## No Data Hardcoding ✅

All content comes from `src/config/landingPageData.ts`:
- ✅ Navigation links
- ✅ Hero text
- ✅ Feature descriptions
- ✅ Job listings
- ✅ Statistics
- ✅ Footer links
- ✅ Button labels

## Common Paths

```
View config:           src/config/landingPageData.ts
View components:       src/components/landing/
View styles:           src/app/globals.css (or your CSS file)
Edit landing page:     src/app/page.tsx
View examples:         src/components/landing/EXAMPLE_IMPLEMENTATION.tsx
View guides:           src/components/landing/COMPLETE_GUIDE.md
```

## Deployment Checklist

- [ ] Edit `landingPageData.ts` with your content
- [ ] Validate config: `validateLandingPageConfig(config)`
- [ ] Test all links work
- [ ] Check responsive design
- [ ] Verify images/icons load
- [ ] No console errors
- [ ] Performance acceptable

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Data not updating | Restart dev server (`npm run dev`) |
| Type errors | Check config matches `LandingPageConfig` interface |
| Styles missing | Ensure CSS classes defined in global styles |
| Config invalid | Run `validateLandingPageConfig()` to see errors |
| Can't find file | Check path is `src/config/landingPageData.ts` |

## Pro Tips

1. Use environment variables for dynamic links
2. Create multiple configs for A/B testing
3. Validate config in pre-deployment
4. Keep configs in version control
5. Document config changes in comments
6. Use template config as starting point

---

**Remember: All edits should be in `src/config/landingPageData.ts` only! 📝**
