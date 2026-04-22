'use client';

import { NavLink, NavAction } from '@/config/landingPageData';

interface NavigationProps {
  links: NavLink[];
  actions: NavAction[];
  brandName: string;
  brandMark: string;
}

export function Navigation({ links, actions, brandName, brandMark }: NavigationProps) {
  return (
    <nav>
      <div className="nav-logo">
        <div className="nav-logo-mark" aria-hidden="true">
          <img
            src="/images/talentflow-logo.png"
            alt=""
            className="nav-logo-image"
          />
        </div>
      </div>
      <div className="nav-links">
        {links.map((link, idx) => (
          <a key={`link-${idx}-${link.label}`} href={link.href}>
            {link.label}
          </a>
        ))}
      </div>
      <div className="nav-ctas">
        {actions.map((action, idx) => (
          <a
            key={`action-${idx}-${action.label}`}
            href={action.href}
            className={`btn btn-${action.variant}`}
          >
            {action.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
