# Data-Driven Landing Page System

## Overview

This is a **zero-hardcoded-data** landing page system where all content is managed through configuration files. The design is based on the provided reference code but completely refactored to be data-driven and reusable.

## Key Features

✅ **No Static Data**: All content comes from configuration  
✅ **Type-Safe**: Full TypeScript support with interfaces  
✅ **Reusable Components**: Each section is independent and composable  
✅ **Easy to Customize**: Just update the config file  
✅ **API-Ready**: Can fetch config from APIs or databases  
✅ **Production-Ready**: Clean, maintainable code structure  
✅ **Zero Design Changes**: Uses the same design as reference code  

## Directory Structure

```
src/
├── config/
│   ├── landingPageData.ts      # All configuration & TypeScript types
│   └── index.ts                # Config exports
└── components/
    └── landing/
        ├── Navigation.tsx          # Navbar component
        ├── HeroSection.tsx         # Hero banner
        ├── FeaturesSection.tsx     # Features grid
        ├── CandidatesSection.tsx   # Candidates section
        ├── RecruitersSection.tsx   # Recruiters section
        ├── BidirectionalSection.tsx# Bidirectional features
        ├── CtaSection.tsx          # Call-to-action section
        ├── Footer.tsx              # Footer component
        ├── LandingPageTemplate.tsx # Main template
        ├── index.ts                # Component exports
        ├── USAGE_GUIDE.md          # Detailed usage documentation
        └── EXAMPLE_IMPLEMENTATION.tsx # Code examples
```

## Quick Start

### 1. Basic Usage

```tsx
import { LandingPageTemplate } from '@/components/landing';
import { defaultLandingPageConfig } from '@/config';

export default function Home() {
  return (
    <LandingPageTemplate 
      config={defaultLandingPageConfig}
      brandName="TalentFlow"
      brandMark="T"
    />
  );
}
```

### 2. Customize Configuration

Edit `src/config/landingPageData.ts` to modify any content:

```ts
export const defaultLandingPageConfig: LandingPageConfig = {
  hero: {
    label: { text: 'Your Text Here', animationClass: 'anim-1' },
    heading: 'Your Heading',
    description: 'Your Description',
    // ... rest of config
  },
  // ... other sections
};
```

### 3. Use Individual Sections

```tsx
import { FeaturesSection } from '@/components/landing';
import { defaultLandingPageConfig } from '@/config';

export default function FeaturePage() {
  return (
    <FeaturesSection
      sectionLabel={defaultLandingPageConfig.features.sectionLabel}
      heading={defaultLandingPageConfig.features.heading}
      subheading={defaultLandingPageConfig.features.subheading}
      cards={defaultLandingPageConfig.features.cards}
    />
  );
}
```

## Configuration Structure

### LandingPageConfig Interface

```ts
interface LandingPageConfig {
  navigation: NavigationConfig;
  hero: HeroContent;
  trustBadges: TrustBadge[];
  heroStats: StatItem[];
  features: FeaturesConfig;
  candidates: CandidatesConfig;
  recruiters: RecruitersConfig;
  bidirectional: BidirectionalConfig;
  cta: CtaConfig;
  footer: FooterConfig;
}
```

### Available Data Types

All TypeScript types are defined in `landingPageData.ts`:

- `NavLink` - Navigation link with label and href
- `NavAction` - Navigation action button (Sign in, Get started)
- `HeroLabel` - Hero section label with animation class
- `HeroContent` - Complete hero section content
- `TrustBadge` - Trust badge with icon, title, subtitle
- `StatItem` - Statistics display (value, label)
- `FeatureCard` - Feature card with icon, title, description
- `FeatureListItem` - Checklist item in sections
- `JobCard` - Job listing preview
- `TalentPoolCard` - Talent pool statistics
- `CandidateSpotlight` - Featured candidate profile
- `BidirectionalFeature` - Bidirectional feature with arrow icon
- `FooterLink` - Footer link
- `FooterColumn` - Footer column with title and links

## Component Details

### Navigation
- Displays brand logo/mark
- Navigation links with smooth scrolling
- Call-to-action buttons (Sign in, Get started)

### HeroSection
- Animated label with dot indicator
- Large heading with subheading formatting
- Description text
- Trust badges with icons
- Call-to-action button
- Statistics display

### FeaturesSection
- Section label and heading
- Grid of feature cards (8 items)
- Each card has icon, title, description

### CandidatesSection
- Split layout (left: content, right: UI preview)
- Section label and heading
- Feature list with checkmarks
- Job cards preview with match percentages

### RecruitersSection
- Split layout (left: content, right: visualization)
- Talent pool visualization
- Top match candidate spotlight
- Hiring message highlight box

### BidirectionalSection
- Section heading and subheading
- Grid of bidirectional features with arrows
- Each feature has title and description

### CtaSection
- Get started heading
- Trust-focused description
- Statistics display
- Call-to-action buttons

### Footer
- Brand logo and description
- Multiple columns with links
- Copyright and tagline

## How to Modify Content

### 1. Change Text Content
Open `src/config/landingPageData.ts` and edit values directly:

```ts
hero: {
  label: {
    text: 'New Label Text', // Change this
    animationClass: 'anim-1'
  },
  heading: 'New Heading', // Change this
  description: 'New description', // Change this
}
```

### 2. Add/Remove Features
Modify the features array:

```ts
features: {
  cards: [
    // Add new feature cards here
    {
      icon: '🚀',
      title: 'New Feature',
      description: 'Feature description'
    },
    // Or remove existing ones
  ]
}
```

### 3. Change Links
Update navigation and footer links:

```ts
navigation: {
  links: [
    { label: 'New Link', href: '/new-page' },
    // Update any link
  ]
}
```

### 4. Customize Statistics
Modify stats anywhere in config:

```ts
heroStats: [
  { value: '99%', label: 'Success rate' },
  { value: '10K+', label: 'Users' },
]
```

## Advanced Usage

### Fetching Config from API

```tsx
async function getLandingConfig(): Promise<LandingPageConfig> {
  const response = await fetch('/api/landing-config');
  return response.json();
}

export default async function Home() {
  const config = await getLandingConfig();
  return <LandingPageTemplate config={config} brandName="TalentFlow" brandMark="T" />;
}
```

### Creating Multiple Variants

```ts
// Create different configs for different pages
export const defaultConfig = { /* ... */ };
export const recruiterConfig = { /* ... */ };
export const candidateConfig = { /* ... */ };
```

### Extending with New Sections

1. Add new interface to `landingPageData.ts`
2. Create new component file
3. Add to `LandingPageConfig` interface
4. Add to `defaultLandingPageConfig`
5. Import and use in `LandingPageTemplate`

## CSS Classes Used

The components use these CSS classes (ensure they're defined in your styles):

- Navigation: `.nav-logo`, `.nav-links`, `.nav-ctas`
- Hero: `.hero`, `.hero-label`, `.hero-stat-num`
- Sections: `.section-label`, `.section-title`, `.section-sub`
- Cards: `.feature-card`, `.job-card`, `.pool-card`
- Buttons: `.btn`, `.btn-brand`, `.btn-ghost`, `.btn-white`
- Layout: `.container`, `.split-grid`, `.features-grid`, `.bidir-grid`

## Error Prevention

✅ **Type Safety**: TypeScript prevents configuration errors  
✅ **No Logic in Components**: Components are pure data renderers  
✅ **Centralized Data**: Single source of truth  
✅ **Easy Validation**: Can validate config before rendering  
✅ **No Runtime Surprises**: All data is typed and known at build time  

## Best Practices

1. **Keep config in one place** - Don't scatter data across components
2. **Use TypeScript interfaces** - Prevents typos and errors
3. **Validate API configs** - If fetching from APIs, validate the response
4. **Separate data by concern** - Group related config together
5. **Use environment variables** - For dynamic values like links, API endpoints
6. **Document changes** - Keep USAGE_GUIDE.md updated

## Testing

Since all data is external, you can easily test different configurations:

```tsx
// Test with different config
const testConfig = { /* modified config */ };
<LandingPageTemplate config={testConfig} {...props} />
```

## Maintenance

When you need to update content:

1. Edit `landingPageData.ts` - the only file that needs changes
2. Components automatically use new data
3. No rebuilding of component logic needed
4. Easy to rollback changes

## Performance

- All components are client-side rendered (using `'use client'`)
- No prop drilling - data is passed directly to components
- Efficient re-renders with memoization (if needed)
- No unnecessary computations

## Migration

To migrate from old landing page:

1. Create new component using `LandingPageTemplate`
2. Copy old page content into `landingPageData.ts`
3. Update component imports
4. Test thoroughly
5. Deploy

## Support

For questions or issues:
- Check USAGE_GUIDE.md for detailed examples
- Review EXAMPLE_IMPLEMENTATION.tsx for code patterns
- Inspect landingPageData.ts for all available options
