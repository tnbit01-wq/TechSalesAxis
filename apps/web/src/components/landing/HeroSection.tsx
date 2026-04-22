'use client';

import { HeroContent, TrustBadge, StatItem } from '@/config/landingPageData';

interface HeroSectionProps {
  content: HeroContent;
  trustBadges: TrustBadge[];
  stats: StatItem[];
  ctaText: string;
  ctaHref: string;
}

export function HeroSection({
  content,
  trustBadges,
  stats,
  ctaText,
  ctaHref,
}: HeroSectionProps) {
  return (
    <section className="hero">
      <div className="hero-grid-bg"></div>
      <div className="hero-glow"></div>

      <div className={`hero-label ${content.label.animationClass}`}>
        <div className="hero-label-dot"></div>
        {content.label.text}
      </div>

      <h1 className={content.animationClasses.heading}>
        {content.heading.split('\n').map((line, i) => (
          <span key={`heading-line-${i}`}>
            {line}
            {i === 0 && <br />}
          </span>
        ))}
      </h1>

      <p className={`hero-sub ${content.animationClasses.description}`}>
        {content.description}
      </p>

      <div className={`hero-trust ${content.animationClasses.trust}`}>
        {trustBadges.map((badge, i) => (
          <div key={`badge-${i}-${badge.title}`} className="trust-badge">
            <div className="trust-icon">{badge.icon}</div>
            <div>
              <div className="trust-text-main">{badge.title}</div>
              <div className="trust-text-sub">{badge.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={`hero-btns ${content.animationClasses.buttons}`}>
        <a href={ctaHref} className="btn btn-brand-lg">
          {ctaText} →
        </a>
      </div>

      <div className={`hero-stats ${content.animationClasses.stats}`}>
        {stats.map((stat, i) => (
          <div key={`stat-${i}-${stat.label}`}>
            <div className="hero-stat-num">{stat.value}</div>
            <div className="hero-stat-lbl">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
