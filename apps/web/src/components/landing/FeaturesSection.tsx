'use client';

import { FeatureCard } from '@/config/landingPageData';

interface FeaturesSectionProps {
  sectionLabel: string;
  heading: string;
  subheading: string;
  cards: FeatureCard[];
  sectionId?: string;
}

function getFeatureHeadingIcon(title: string) {
  const value = title.toLowerCase();

  if (value.includes('ai')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" fill="currentColor" />
      </svg>
    );
  }

  if (value.includes('matching')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h6M14 7h6M7 4l3 3-3 3M17 4l-3 3 3 3M4 17h6M14 17h6M7 14l3 3-3 3M17 14l-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (value.includes('visualization') || value.includes('analytics')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h16M7 16v-5M12 16V7M17 16v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (value.includes('interview')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 3v3M16 3v3M4 9h16M6 6h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (value.includes('chat')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-5 4v-4H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (value.includes('team')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 2a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 4v5c0 5-3.3 8-7 9-3.7-1-7-4-7-9V7l7-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FeaturesSection({
  sectionLabel,
  heading,
  subheading,
  cards,
  sectionId = 'features',
}: FeaturesSectionProps) {
  return (
    <section className="features" id={sectionId}>
      <div className="features-container">
        <div style={{ textAlign: 'left', marginBottom: '3rem' }}>
          <div className="section-label">{sectionLabel}</div>
          <h2 className="section-heading">
            {heading.split('\n').map((line, i) => (
              <span key={`heading-line-${i}`}>
                {line}
                {i < heading.split('\n').length - 1 && <br />}
              </span>
            ))}
          </h2>
          <p className="section-subheading">
            {subheading}
          </p>
        </div>
        <div className="feature-cards">
          {cards.map((card, i) => (
            <div key={`card-${i}-${card.title}`} className="feature-card">
              <div className="feature-title-row">
                <span className="feature-title-icon">{getFeatureHeadingIcon(card.title)}</span>
                <h3 className="feature-title">{card.title}</h3>
              </div>
              <p className="feature-description">{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
