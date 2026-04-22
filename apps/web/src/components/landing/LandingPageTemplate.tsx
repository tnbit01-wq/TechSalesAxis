'use client';

import './landing.css';
import { LandingPageConfig } from '@/config/landingPageData';
import { Navigation } from './Navigation';
import { HeroSection } from './HeroSection';
import { FeaturesSection } from './FeaturesSection';
import { CandidatesSection } from './CandidatesSection';
import { RecruitersSection } from './RecruitersSection';
import { BidirectionalSection } from './BidirectionalSection';
import { CtaSection } from './CtaSection';
import { Footer } from './Footer';

interface LandingPageProps {
  config: LandingPageConfig;
  brandName: string;
  brandMark: string;
}

export function LandingPageTemplate({
  config,
  brandName,
  brandMark,
}: LandingPageProps) {
  return (
    <>
      {/* NAV */}
      <Navigation
        links={config.navigation.links}
        actions={config.navigation.actions}
        brandName={brandName}
        brandMark={brandMark}
      />

      {/* HERO */}
      <HeroSection
        content={config.hero}
        trustBadges={config.trustBadges}
        stats={config.heroStats}
        ctaText={config.hero.ctaText}
        ctaHref={config.hero.ctaHref}
      />

      {/* FEATURES */}
      <FeaturesSection
        sectionLabel={config.features.sectionLabel}
        heading={config.features.heading}
        subheading={config.features.subheading}
        cards={config.features.cards}
        sectionId="features"
      />

      {/* CANDIDATES */}
      <CandidatesSection
        sectionLabel={config.candidates.sectionLabel}
        heading={config.candidates.heading}
        subheading={config.candidates.subheading}
        features={config.candidates.features}
        ctaText={config.candidates.ctaText}
        ctaHref={config.candidates.ctaHref}
        jobCards={config.candidates.jobCards}
      />

      {/* RECRUITERS */}
      <RecruitersSection
        sectionLabel={config.recruiters.sectionLabel}
        heading={config.recruiters.heading}
        subheading={config.recruiters.subheading}
        features={config.recruiters.features}
        ctaText={config.recruiters.ctaText}
        ctaHref={config.recruiters.ctaHref}
        talentPools={config.recruiters.talentPools}
        topMatch={config.recruiters.topMatch}
        hiringMessage={config.recruiters.hiringMessage}
      />

      {/* BIDIRECTIONAL */}
      <BidirectionalSection
        sectionLabel={config.bidirectional.sectionLabel}
        heading={config.bidirectional.heading}
        subheading={config.bidirectional.subheading}
        features={config.bidirectional.features}
        sectionId="trust"
      />

      {/* CTA */}
      <CtaSection
        heading={config.cta.heading}
        description={config.cta.description}
        stats={config.cta.stats}
        buttons={config.cta.buttons}
      />

      {/* FOOTER */}
      <Footer
        brandMark={brandMark}
        brandName={brandName}
        brandDescription={config.footer.brandDescription}
        tagline={config.footer.tagline}
        columns={config.footer.columns}
        copyright={config.footer.copyright}
        madeFor={config.footer.madeFor}
      />
    </>
  );
}
