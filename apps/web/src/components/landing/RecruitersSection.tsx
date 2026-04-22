'use client';

import { FeatureListItem, TalentPoolCard, CandidateSpotlight } from '@/config/landingPageData';

interface RecruitersSectionProps {
  sectionLabel: string;
  heading: string;
  subheading: string;
  features: FeatureListItem[];
  ctaText: string;
  ctaHref: string;
  talentPools: TalentPoolCard[];
  topMatch: CandidateSpotlight;
  hiringMessage: string;
}

export function RecruitersSection({
  sectionLabel,
  heading,
  subheading,
  features,
  ctaText,
  ctaHref,
  talentPools,
  topMatch,
  hiringMessage,
}: RecruitersSectionProps) {
  return (
    <section className="recruiters" id="recruiters">
      <div className="section-grid">
        <div>
          <div className="section-label">{sectionLabel}</div>
          <h2 className="section-heading">
            {heading.split('\n').map((line, i) => (
              <span key={`heading-line-${i}`}>
                {line}
                {i < heading.split('\n').length - 1 && <br />}
              </span>
            ))}
          </h2>
          <p className="section-subheading">{subheading}</p>
          <div className="feature-list">
            {features.map((item, i) => (
              <div key={`feature-${i}-${item.title}`} className="feature-item">
                <div className="feature-dot">{item.dot}</div>
                <div>
                  <div className="feature-text-title">{item.title}</div>
                  <div className="feature-text-desc">{item.description}</div>
                </div>
              </div>
            ))}
          </div>
          <a href={ctaHref} className="btn btn-brand-lg">
            {ctaText}
          </a>
        </div>
        <div>
          <div className="talent-pools">
            {talentPools.length > 0 ? (
              talentPools.map((pool, i) => (
                <div key={`pool-${i}-${pool.tier}`} className="pool-card">
                  <div className="pool-count">{pool.count}</div>
                  <div className="pool-tier">{pool.tier}</div>
                  <div className="pool-roles">{pool.roles}</div>
                </div>
              ))
            ) : (
              <div className="pool-card pool-card-empty">
                <div className="pool-count">Live</div>
                <div className="pool-tier">Talent signals</div>
                <div className="pool-roles">Available after recruiter sign in</div>
              </div>
            )}
          </div>
          <div className="candidate-spotlight">
            <div className="candidate-initials">{topMatch.initials}</div>
            <div className="candidate-name">{topMatch.name}</div>
            <div className="candidate-experience">{topMatch.experience}</div>
            <div className="candidate-availability">{topMatch.availability}</div>
            <div className="candidate-quote">"{topMatch.quote}"</div>
            {topMatch.matchPercentage > 0 && (
              <div className="candidate-match">{topMatch.matchPercentage}%</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
