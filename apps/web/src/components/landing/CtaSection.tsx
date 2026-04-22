'use client';

import { StatItem } from '@/config/landingPageData';

interface CtaSectionProps {
  heading: string;
  description: string;
  stats: StatItem[];
  buttons: Array<{
    label: string;
    href: string;
    variant: 'white' | 'outline-white';
  }>;
}

export function CtaSection({
  heading,
  description,
  stats,
  buttons,
}: CtaSectionProps) {
  return (
    <section className="cta">
      <div className="cta-container">
        <h2 className="cta-heading">{heading}</h2>
        <p className="cta-description">{description}</p>
        <div className="cta-stats">
          {stats.map((stat, i) => (
            <div key={`stat-${i}-${stat.label}`} className="cta-stat">
              <div className="cta-stat-value">{stat.value}</div>
              <div className="cta-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
        <div className="cta-buttons">
          {buttons.map((button, i) => (
            <a
              key={`button-${i}-${button.label}`}
              href={button.href}
              className={`btn btn-${button.variant}`}
            >
              {button.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
