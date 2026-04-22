'use client';

import { FooterColumn } from '@/config/landingPageData';

interface FooterProps {
  brandMark: string;
  brandName: string;
  brandDescription: string;
  tagline: string;
  columns: FooterColumn[];
  copyright: string;
  madeFor: string;
}

export function Footer({
  brandMark,
  brandName,
  brandDescription,
  tagline,
  columns,
  copyright,
  madeFor,
}: FooterProps) {
  return (
    <footer>
      <div className="footer-container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <div className="footer-brand-mark" aria-hidden="true">
                <img
                  src="/images/talentflow-logo.png"
                  alt=""
                  className="footer-logo-image"
                />
              </div>
              <div className="footer-brand-name">{brandName}</div>
            </div>
            <p className="footer-description">{brandDescription}</p>
          </div>
          {columns.map((column, i) => (
            <div key={`column-${i}-${column.title}`}>
              <h4 className="footer-column-title">
                <span className="footer-column-dot"></span>
                {column.title}
              </h4>
              <div className="footer-links">
                {column.links.map((link, idx) => (
                  <a key={`link-${idx}-${link.label}`} href={link.href} className="footer-link">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span className="footer-copyright">{copyright}</span>
          <span className="footer-made-for">{madeFor}</span>
        </div>
      </div>
    </footer>
  );
}
