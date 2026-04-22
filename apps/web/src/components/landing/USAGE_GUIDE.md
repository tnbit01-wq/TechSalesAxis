/**
 * LANDING PAGE USAGE GUIDE
 * 
 * This is a fully data-driven landing page system with NO static data hardcoded.
 * All content is managed through configuration files and component props.
 * 
 * FILE STRUCTURE:
 * ├── src/
 * │   ├── config/
 * │   │   ├── landingPageData.ts    (All configuration data & TypeScript interfaces)
 * │   │   └── index.ts              (Config exports)
 * │   └── components/
 * │       └── landing/
 * │           ├── Navigation.tsx        (Data-driven navigation)
 * │           ├── HeroSection.tsx       (Data-driven hero section)
 * │           ├── FeaturesSection.tsx   (Data-driven features grid)
 * │           ├── CandidatesSection.tsx (Data-driven candidates section)
 * │           ├── RecruitersSection.tsx (Data-driven recruiters section)
 * │           ├── BidirectionalSection.tsx (Data-driven bidirectional features)
 * │           ├── CtaSection.tsx        (Data-driven CTA section)
 * │           ├── Footer.tsx            (Data-driven footer)
 * │           ├── LandingPageTemplate.tsx (Main template combining all sections)
 * │           └── index.ts             (Component exports)
 * 
 * BASIC USAGE:
 * ============
 * 
 * import { LandingPageTemplate } from '@/components/landing';
 * import { defaultLandingPageConfig } from '@/config';
 * 
 * export default function Home() {
 *   return (
 *     <LandingPageTemplate 
 *       config={defaultLandingPageConfig}
 *       brandName="TalentFlow"
 *       brandMark="T"
 *     />
 *   );
 * }
 * 
 * 
 * CUSTOMIZING DATA:
 * =================
 * 
 * 1. MODIFY EXISTING CONFIG:
 *    In src/config/landingPageData.ts, update the defaultLandingPageConfig object.
 *    All values are data-driven and can be modified without touching component code.
 * 
 * 2. CREATE CUSTOM CONFIGS:
 *    export const customLandingPageConfig: LandingPageConfig = {
 *      // ... your custom configuration
 *    };
 * 
 * 3. DYNAMIC CONFIGS:
 *    You can create configs from APIs, databases, or environment variables:
 * 
 *    export async function getConfig(): Promise<LandingPageConfig> {
 *      const data = await fetch('your-api-endpoint');
 *      return transformToConfig(data);
 *    }
 * 
 * 
 * USING INDIVIDUAL SECTIONS:
 * ==========================
 * 
 * You can use individual sections separately:
 * 
 * import { 
 *   Navigation, 
 *   FeaturesSection, 
 *   Footer 
 * } from '@/components/landing';
 * import { defaultLandingPageConfig } from '@/config';
 * 
 * export default function CustomPage() {
 *   return (
 *     <>
 *       <Navigation
 *         links={defaultLandingPageConfig.navigation.links}
 *         actions={defaultLandingPageConfig.navigation.actions}
 *         brandName="TalentFlow"
 *         brandMark="T"
 *       />
 *       <FeaturesSection
 *         sectionLabel={defaultLandingPageConfig.features.sectionLabel}
 *         heading={defaultLandingPageConfig.features.heading}
 *         subheading={defaultLandingPageConfig.features.subheading}
 *         cards={defaultLandingPageConfig.features.cards}
 *       />
 *       <Footer {...} />
 *     </>
 *   );
 * }
 * 
 * 
 * DATA TYPES:
 * ===========
 * 
 * All data is fully typed with TypeScript interfaces defined in landingPageData.ts:
 * - NavLink
 * - NavAction
 * - HeroLabel
 * - HeroContent
 * - TrustBadge
 * - StatItem
 * - FeatureCard
 * - FeatureListItem
 * - JobCard
 * - TalentPoolCard
 * - CandidateSpotlight
 * - BidirectionalFeature
 * - FooterLink
 * - FooterColumn
 * - LandingPageConfig
 * 
 * 
 * STYLING:
 * ========
 * 
 * The components use CSS classes that should be defined in your global styles:
 * - .nav-logo, .nav-links, .nav-ctas
 * - .hero, .hero-label, .hero-stat-num
 * - .section-label, .section-title, .section-sub
 * - .feature-card, .feature-icon
 * - .job-card, .match-pill
 * - .talent-pools, .candidate-avatar
 * - .btn, .btn-brand, .btn-ghost, .btn-white
 * - .container, .split-grid, .features-grid, .bidir-grid
 * 
 * Ensure your CSS file includes all these styles.
 * 
 * 
 * ADDING NEW SECTIONS:
 * ====================
 * 
 * 1. Add data interface to landingPageData.ts
 * 2. Add data to defaultLandingPageConfig
 * 3. Create new component file in components/landing/
 * 4. Export component from components/landing/index.ts
 * 5. Add section to LandingPageTemplate.tsx
 * 6. Update LandingPageConfig interface to include new section
 * 
 * 
 * NO HARDCODED DATA:
 * ==================
 * 
 * This system ensures:
 * ✓ Zero hardcoded text in components
 * ✓ All content comes from configuration
 * ✓ Easy to maintain and update
 * ✓ Reusable across different landing pages
 * ✓ Type-safe with TypeScript
 * ✓ Easy to fetch from APIs or databases
 */
