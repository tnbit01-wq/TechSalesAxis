'use client';

import { FeatureListItem, JobCard } from '@/config/landingPageData';

interface CandidatesSectionProps {
  sectionLabel: string;
  heading: string;
  subheading: string;
  features: FeatureListItem[];
  ctaText: string;
  ctaHref: string;
  jobCards: JobCard[];
}

export function CandidatesSection({
  sectionLabel,
  heading,
  subheading,
  features,
  ctaText,
  ctaHref,
  jobCards,
}: CandidatesSectionProps) {
  return (
    <section className="candidates" id="candidates">
      <div className="section-grid">
        <div>
          <div className="section-label">{sectionLabel}</div>
          <h2 className="section-heading">{heading}</h2>
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
          <div className="job-cards">
            {jobCards.length > 0 ? (
              jobCards.map((job, i) => (
                <div key={`job-${i}-${job.title}`} className="job-card">
                  <div className="job-info">
                    <div className="job-title">{job.title}</div>
                    <div className="job-company">{job.company}</div>
                    <div className="job-type">{job.type}</div>
                  </div>
                  <span className="match-percentage">{job.matchPercentage}%</span>
                </div>
              ))
            ) : (
              <div className="job-card job-card-empty">
                <div className="job-info">
                  <div className="job-title">Live matches appear after sign in</div>
                  <div className="job-company">Recommendations are generated from verified profile data.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
