'use client';

import { BidirectionalFeature } from '@/config/landingPageData';

interface BidirectionalSectionProps {
  sectionLabel: string;
  heading: string;
  subheading: string;
  features: BidirectionalFeature[];
  sectionId?: string;
}

function getBidirectionalHeadingIcon(title: string) {
  const value = title.toLowerCase();

  if (value.includes('ai')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" fill="currentColor" />
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

  if (value.includes('interview')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 3v3M16 3v3M4 9h16M6 6h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (value.includes('verified') || value.includes('network')) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 4v5c0 5-3.3 8-7 9-3.7-1-7-4-7-9V7l7-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h16M7 16v-5M12 16V7M17 16v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BidirectionalSection({
  sectionLabel,
  heading,
  subheading,
  features,
  sectionId = 'trust',
}: BidirectionalSectionProps) {
  return (
    <section className="bidirectional" id={sectionId}>
      <div className="bidir-container">
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
        <div className="bidir-grid">
          {features.map((feature, i) => (
            <div key={`feature-${i}-${feature.title}`} className="bidir-card">
              <div className="bidir-title-row">
                <span className="bidir-title-icon">{getBidirectionalHeadingIcon(feature.title)}</span>
                <h3 className="bidir-title">{feature.title}</h3>
              </div>
              <p className="bidir-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
