'use client';

/**
 * EXAMPLE LANDING PAGE IMPLEMENTATION
 * 
 * This is an example of how to use the LandingPageTemplate with the
 * configuration-driven system.
 * 
 * Key features:
 * - All content comes from config, no hardcoded data
 * - Can be easily customized by modifying the config
 * - Can be extended with additional sections
 * - Fully type-safe with TypeScript
 */

import { LandingPageTemplate } from '@/components/landing';
import { defaultLandingPageConfig } from '@/config';

export default function LandingPageExample() {
  // Example 1: Using default configuration
  return (
    <LandingPageTemplate 
      config={defaultLandingPageConfig}
      brandName="TalentFlow"
      brandMark="T"
    />
  );
}

// Example 2: Using custom configuration
/*
import { LandingPageConfig } from '@/config';

const customConfig: LandingPageConfig = {
  // Copy and modify from defaultLandingPageConfig
  ...defaultLandingPageConfig,
  hero: {
    ...defaultLandingPageConfig.hero,
    label: {
      text: 'My Custom Platform',
      animationClass: 'anim-1',
    },
  },
};

export default function CustomLandingPage() {
  return (
    <LandingPageTemplate 
      config={customConfig}
      brandName="MyBrand"
      brandMark="M"
    />
  );
}
*/

// Example 3: Fetching config from API
/*
import { LandingPageTemplate } from '@/components/landing';
import { LandingPageConfig } from '@/config';

async function fetchLandingConfig(): Promise<LandingPageConfig> {
  const response = await fetch('/api/landing-config');
  return response.json();
}

export default async function DynamicLandingPage() {
  const config = await fetchLandingConfig();
  
  return (
    <LandingPageTemplate 
      config={config}
      brandName="TalentFlow"
      brandMark="T"
    />
  );
}
*/

// Example 4: Using individual sections
/*
import { Navigation, HeroSection, FeaturesSection, Footer } from '@/components/landing';
import { defaultLandingPageConfig } from '@/config';

export default function CustomLayout() {
  return (
    <>
      <Navigation 
        links={defaultLandingPageConfig.navigation.links}
        actions={defaultLandingPageConfig.navigation.actions}
        brandName="TalentFlow"
        brandMark="T"
      />
      
      <HeroSection 
        content={defaultLandingPageConfig.hero}
        trustBadges={defaultLandingPageConfig.trustBadges}
        stats={defaultLandingPageConfig.heroStats}
        ctaText="Start now"
        ctaHref="#"
      />
      
      <FeaturesSection
        sectionLabel={defaultLandingPageConfig.features.sectionLabel}
        heading={defaultLandingPageConfig.features.heading}
        subheading={defaultLandingPageConfig.features.subheading}
        cards={defaultLandingPageConfig.features.cards}
      />
      
      <Footer
        brandMark="T"
        brandName="TalentFlow"
        brandDescription={defaultLandingPageConfig.footer.brandDescription}
        tagline={defaultLandingPageConfig.footer.tagline}
        columns={defaultLandingPageConfig.footer.columns}
        copyright={defaultLandingPageConfig.footer.copyright}
        madeFor={defaultLandingPageConfig.footer.madeFor}
      />
    </>
  );
}
*/
