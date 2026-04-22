/**
 * Configuration validation utilities
 * 
 * These utilities help validate and manage landing page configurations
 * to ensure no errors or missing data.
 */

import { LandingPageConfig } from './landingPageData';

/**
 * Validates if a configuration object has all required fields
 */
export function validateLandingPageConfig(config: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check root level sections
  const requiredSections = [
    'navigation',
    'hero',
    'trustBadges',
    'heroStats',
    'features',
    'candidates',
    'recruiters',
    'bidirectional',
    'cta',
    'footer',
  ];

  requiredSections.forEach((section) => {
    if (!config[section]) {
      errors.push(`Missing section: ${section}`);
    }
  });

  // Validate navigation
  if (config.navigation) {
    if (!Array.isArray(config.navigation.links)) {
      errors.push('navigation.links must be an array');
    }
    if (!Array.isArray(config.navigation.actions)) {
      errors.push('navigation.actions must be an array');
    }
  }

  // Validate hero
  if (config.hero) {
    if (!config.hero.label?.text) errors.push('hero.label.text is required');
    if (!config.hero.heading) errors.push('hero.heading is required');
    if (!config.hero.description) errors.push('hero.description is required');
  }

  // Validate arrays
  const arrayFields = [
    { path: 'trustBadges', name: 'trustBadges' },
    { path: 'heroStats', name: 'heroStats' },
    { path: 'features.cards', name: 'features.cards' },
    { path: 'candidates.features', name: 'candidates.features' },
    { path: 'candidates.jobCards', name: 'candidates.jobCards' },
    { path: 'recruiters.talentPools', name: 'recruiters.talentPools' },
    { path: 'bidirectional.features', name: 'bidirectional.features' },
    { path: 'cta.stats', name: 'cta.stats' },
  ];

  arrayFields.forEach(({ path, name }) => {
    const keys = path.split('.');
    let value = config;
    for (const key of keys) {
      value = value?.[key];
    }
    if (!Array.isArray(value)) {
      errors.push(`${name} must be an array`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merges a custom config with the default config
 * Ensures all required fields are present
 */
export function mergeConfigs(
  baseConfig: LandingPageConfig,
  overrides: Partial<LandingPageConfig>
): LandingPageConfig {
  return {
    ...baseConfig,
    ...overrides,
    navigation: {
      ...baseConfig.navigation,
      ...overrides.navigation,
    },
    hero: {
      ...baseConfig.hero,
      ...overrides.hero,
    },
    features: {
      ...baseConfig.features,
      ...overrides.features,
    },
    candidates: {
      ...baseConfig.candidates,
      ...overrides.candidates,
    },
    recruiters: {
      ...baseConfig.recruiters,
      ...overrides.recruiters,
    },
    bidirectional: {
      ...baseConfig.bidirectional,
      ...overrides.bidirectional,
    },
    cta: {
      ...baseConfig.cta,
      ...overrides.cta,
    },
    footer: {
      ...baseConfig.footer,
      ...overrides.footer,
    },
  };
}

/**
 * Gets missing fields in a configuration
 */
export function getMissingFields(config: any): string[] {
  const validation = validateLandingPageConfig(config);
  return validation.errors;
}

/**
 * Counts total items in a configuration
 */
export function countConfigItems(config: LandingPageConfig): {
  features: number;
  trustBadges: number;
  heroStats: number;
  jobCards: number;
  talentPools: number;
  bidirectionalFeatures: number;
  total: number;
} {
  return {
    features: config.features.cards.length,
    trustBadges: config.trustBadges.length,
    heroStats: config.heroStats.length,
    jobCards: config.candidates.jobCards.length,
    talentPools: config.recruiters.talentPools.length,
    bidirectionalFeatures: config.bidirectional.features.length,
    total:
      config.features.cards.length +
      config.trustBadges.length +
      config.heroStats.length +
      config.candidates.jobCards.length +
      config.recruiters.talentPools.length +
      config.bidirectional.features.length,
  };
}

/**
 * Validates and logs configuration details
 * Useful for debugging
 */
export function debugConfig(config: LandingPageConfig): void {
  const validation = validateLandingPageConfig(config);
  const counts = countConfigItems(config);

  console.group('Landing Page Configuration Debug');

  if (validation.valid) {
    console.log('✅ Configuration is valid');
  } else {
    console.error('❌ Configuration has errors:');
    validation.errors.forEach((err) => console.error(`  - ${err}`));
  }

  console.log('Items count:', counts);

  // Check for empty arrays that should have content
  const warnings: string[] = [];
  if (config.features.cards.length === 0) warnings.push('Features section has no cards');
  if (config.trustBadges.length === 0) warnings.push('No trust badges');
  if (config.candidates.jobCards.length === 0)
    warnings.push('Candidates section has no job cards');
  if (config.recruiters.talentPools.length === 0)
    warnings.push('Recruiters section has no talent pools');

  if (warnings.length > 0) {
    console.warn('⚠️ Warnings:');
    warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  console.groupEnd();
}

/**
 * Creates a template config with placeholder values
 * Useful for starting a new config
 */
export function createTemplateConfig(): LandingPageConfig {
  return {
    navigation: {
      links: [
        { label: 'Link 1', href: '#section1' },
        { label: 'Link 2', href: '#section2' },
      ],
      actions: [
        { label: 'Action 1', href: '#', variant: 'ghost' },
        { label: 'Action 2', href: '#', variant: 'brand' },
      ],
    },
    hero: {
      label: { text: 'Label text', animationClass: 'anim-1' },
      heading: 'Main Heading\nWith Secondary',
      subheading: 'Secondary',
      description: 'Description text here',
      ctaText: 'Start now',
      ctaHref: '/get-started',
      animationClasses: {
        heading: 'anim-2',
        description: 'anim-3',
        trust: 'anim-4',
        buttons: 'anim-5',
        stats: 'anim-6',
      },
    },
    trustBadges: [
      { icon: '✓', title: 'Badge 1', subtitle: 'Subtitle' },
    ],
    heroStats: [
      { value: '100%', label: 'Stat 1' },
    ],
    features: {
      sectionLabel: 'Section label',
      heading: 'Section heading',
      subheading: 'Section subheading',
      cards: [
        { icon: '💬', title: 'Feature', description: 'Description' },
      ],
    },
    candidates: {
      sectionLabel: 'Section label',
      heading: 'Section heading',
      subheading: 'Section subheading',
      features: [
        { dot: '✓', title: 'Feature', description: 'Description' },
      ],
      ctaText: 'CTA Text',
      ctaHref: '#',
      jobCards: [
        { title: 'Job Title', company: 'Company', type: 'Full-time', matchPercentage: 95 },
      ],
    },
    recruiters: {
      sectionLabel: 'Section label',
      heading: 'Section heading',
      subheading: 'Section subheading',
      features: [
        { dot: '✓', title: 'Feature', description: 'Description' },
      ],
      ctaText: 'CTA Text',
      ctaHref: '#',
      talentPools: [
        { count: 45, tier: 'Tier', roles: 'Roles' },
      ],
      topMatch: {
        initials: 'AB',
        name: 'Name',
        experience: 'Experience',
        availability: 'Available',
        quote: 'Quote',
        matchPercentage: 95,
      },
      hiringMessage: 'Message here',
    },
    bidirectional: {
      sectionLabel: 'Section label',
      heading: 'Section heading',
      subheading: 'Section subheading',
      features: [
        { icon: '↔', title: 'Feature', description: 'Description' },
      ],
    },
    cta: {
      heading: 'CTA heading',
      description: 'CTA description',
      stats: [
        { value: '100%', label: 'Stat' },
      ],
      buttons: [
        { label: 'Button 1', href: '#', variant: 'white' },
        { label: 'Button 2', href: '#', variant: 'outline-white' },
      ],
    },
    footer: {
      brandDescription: 'Brand description',
      tagline: 'Tagline',
      columns: [
        {
          title: 'Column',
          links: [{ label: 'Link', href: '#' }],
        },
      ],
      copyright: 'Copyright text',
      madeFor: 'Made for...',
    },
  };
}
