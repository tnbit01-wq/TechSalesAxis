export interface NavLink {
  label: string;
  href: string;
}

export interface NavAction {
  label: string;
  href: string;
  variant: 'ghost' | 'brand';
}

export interface HeroLabel {
  text: string;
  animationClass: string;
}

export interface HeroContent {
  label: HeroLabel;
  heading: string;
  subheading: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  animationClasses: {
    heading: string;
    description: string;
    trust: string;
    buttons: string;
    stats: string;
  };
}

export interface TrustBadge {
  icon: string;
  title: string;
  subtitle: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface FeatureCard {
  icon: string;
  title: string;
  description: string;
}

export interface FeatureListItem {
  dot: string;
  title: string;
  description: string;
}

export interface JobCard {
  title: string;
  company: string;
  type: string;
  matchPercentage: number;
}

export interface TalentPoolCard {
  count: number;
  tier: string;
  roles: string;
}

export interface CandidateSpotlight {
  initials: string;
  name: string;
  experience: string;
  availability: string;
  quote: string;
  matchPercentage: number;
}

export interface BidirectionalFeature {
  icon: string;
  title: string;
  description: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface LandingPageConfig {
  navigation: {
    links: NavLink[];
    actions: NavAction[];
  };
  hero: HeroContent;
  trustBadges: TrustBadge[];
  heroStats: StatItem[];
  features: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    cards: FeatureCard[];
  };
  candidates: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    features: FeatureListItem[];
    ctaText: string;
    ctaHref: string;
    jobCards: JobCard[];
  };
  recruiters: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    features: FeatureListItem[];
    ctaText: string;
    ctaHref: string;
    talentPools: TalentPoolCard[];
    topMatch: CandidateSpotlight;
    hiringMessage: string;
  };
  bidirectional: {
    sectionLabel: string;
    heading: string;
    subheading: string;
    features: BidirectionalFeature[];
  };
  cta: {
    heading: string;
    description: string;
    stats: StatItem[];
    buttons: Array<{
      label: string;
      href: string;
      variant: 'white' | 'outline-white';
    }>;
  };
  footer: {
    brandDescription: string;
    tagline: string;
    columns: FooterColumn[];
    copyright: string;
    madeFor: string;
  };
}

export const defaultLandingPageConfig: LandingPageConfig = {
  navigation: {
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Candidates', href: '#candidates' },
      { label: 'Recruiters', href: '#recruiters' },
      { label: 'Why choose us', href: '#trust' },
    ],
    actions: [
      { label: 'Sign in', href: '/auth/candidate/login', variant: 'ghost' },
      { label: 'Get started', href: '/get-started', variant: 'brand' },
    ],
  },
  hero: {
    label: {
      text: 'Conversational Hiring Platform',
      animationClass: 'anim-1',
    },
    heading: 'Hire Smarter.\nConnect Faster.',
    subheading: 'Real Connections.',
    description:
      'AI-powered hiring with high-signal profiles, contextual matching, and conversation-first workflows that convert interest into interviews.',
    ctaText: 'Start now',
    ctaHref: '/get-started',
    animationClasses: {
      heading: 'anim-2',
      description: 'anim-3',
      trust: 'anim-4',
      buttons: 'anim-5',
      stats: 'anim-6',
    },
  },
  trustBadges: [
    {
      icon: 'ID',
      title: 'Identity Verified',
      subtitle: 'Profile trust signals before first outreach',
    },
    {
      icon: 'SK',
      title: 'Skill Authenticated',
      subtitle: 'Role-relevant evidence captured conversationally',
    },
    {
      icon: 'RD',
      title: 'Career Ready',
      subtitle: 'Availability, intent, and fit made visible',
    },
  ],
  heroStats: [
    { value: 'Signal-Rich', label: 'Talent profiles' },
    { value: 'Role-Aware', label: 'Matching engine' },
    { value: 'Conversation-Led', label: 'Hiring flow' },
    { value: 'Interview-Ready', label: 'Candidate quality' },
  ],
  features: {
    sectionLabel: 'Powered by real technology',
    heading: 'Built to capture attention\nand drive real hiring outcomes',
    subheading: 'Production-ready capabilities that turn fragmented hiring steps into one intelligent, high-conversion flow.',
    cards: [
      {
        icon: 'AI',
        title: 'Conversational AI',
        description: 'Chat-like profile building with natural language capture instead of long forms.',
      },
      {
        icon: 'FIT',
        title: 'Smart matching',
        description: 'Multi-factor matching across skills, experience, intent, and role fit.',
      },
      {
        icon: 'DATA',
        title: 'Talent visualization',
        description: 'Clear talent visualization that surfaces experience, location, and readiness at a glance.',
      },
      {
        icon: 'SCHED',
        title: 'Interview integration',
        description: 'Propose times, confirm availability, and move quickly from match to conversation.',
      },
      {
        icon: 'CHAT',
        title: 'Direct chat',
        description: 'Thread-based messaging for fast, natural conversations between both sides.',
      },
      {
        icon: 'INSIGHTS',
        title: 'Analytics & insights',
        description: 'Hiring funnel metrics and talent insights that support better decisions.',
      },
      {
        icon: 'TEAM',
        title: 'Team management',
        description: 'Shared workflows that keep teams aligned while they collaborate.',
      },
      {
        icon: 'TRUST',
        title: 'Proctored assessment',
        description: 'Verified assessment signals and trust checks that strengthen confidence in results.',
      },
    ],
  },
  candidates: {
    sectionLabel: 'For candidates',
    heading: 'Stop applying blind',
    subheading:
      'Your skills matter. The experience highlights fit, context, and intent instead of keyword noise.',
    features: [
      {
        dot: '✓',
        title: 'Conversational profile',
        description:
          'Share your background naturally. The flow captures context without long forms.',
      },
      {
        dot: '✓',
        title: 'Smart job recommendations',
        description:
          'Matches are surfaced with clear reasons so the fit is easy to understand.',
      },
      {
        dot: '✓',
        title: 'Zero spam, zero noise',
        description:
          'Only relevant opportunities and verified conversations reach the inbox.',
      },
      {
        dot: '✓',
        title: 'Career insights',
        description:
          'Readiness signals and guidance help move the search forward faster.',
      },
    ],
    ctaText: 'Create your profile →',
    ctaHref: '/signup?role=candidate',
    jobCards: [],
  },
  recruiters: {
    sectionLabel: 'For recruiters',
    heading: 'Hire quality,\nnot volume',
    subheading:
      'Pre-vetted talent. AI-powered discovery. Skip screening and move to quality conversations.',
    features: [
      {
        dot: '✓',
        title: 'AI talent discovery',
        description:
          'Visualize and filter talent pools in seconds so the right people surface quickly.',
      },
      {
        dot: '✓',
        title: '100% pre-vetted talent',
        description:
          'Identity verification and screening signals reduce fake profiles and wasted outreach.',
      },
      {
        dot: '✓',
        title: 'Integrated pipeline',
        description:
          'Jobs, applications, interviews, and offers stay connected in one flow.',
      },
      {
        dot: '✓',
        title: 'Conversation history',
        description:
          'Conversation history helps you understand intent and readiness before outreach.',
      },
    ],
    ctaText: 'Start hiring →',
    ctaHref: '/signup?role=recruiter',
    talentPools: [],
    topMatch: {
      initials: 'VP',
      name: 'Verified profile',
      experience: 'Profile insight available after sign in',
      availability: 'Real-time availability',
      quote: 'Candidate snapshots become visible after onboarding and access checks',
      matchPercentage: 0,
    },
    hiringMessage: 'skip screening and start quality conversations from day one.',
  },
  bidirectional: {
    sectionLabel: 'Bidirectional platform',
    heading: 'Both sides get powerful AI.\nNo sacrifices.',
    subheading:
      'No recruiter-centric features that ignore candidates. No candidate tools that leave recruiters behind.',
    features: [
      {
        icon: 'AI',
        title: 'Conversational AI',
        description:
          'Candidates and recruiters both move through natural conversation threads.',
      },
      {
        icon: 'CHAT',
        title: 'Direct chat',
        description:
          'Real-time messaging keeps questions and answers in one place.',
      },
      {
        icon: 'CAL',
        title: 'Integrated interviews',
        description:
          'Candidates propose times, recruiters confirm, and the workflow stays simple.',
      },
      {
        icon: 'VERIFIED',
        title: 'Verified network',
        description:
          'Both sides are verified so the network stays trustworthy.',
      },
      {
        icon: 'FIT',
        title: 'Smart matching',
        description:
          'Candidates see fit scores and recruiters see ranked matches.',
      },
      {
        icon: 'DATA',
        title: 'Transparent data',
        description:
          'Both sides understand why a match appears, with no hidden black boxes.',
      },
    ],
  },
  cta: {
    heading: 'The platform built on trust',
    description:
      'Every candidate verified. Every recruiter validated. Every conversation recorded. Transparent matching for a cleaner hiring flow.',
    stats: [
      { value: 'Identity', label: 'Verification first' },
      { value: 'Signals', label: 'Multi-factor fit' },
      { value: 'Quality', label: 'Curated interactions' },
      { value: 'Workflow', label: 'End-to-end hiring' },
    ],
    buttons: [
      { label: 'Get started free', href: '/get-started', variant: 'white' },
      { label: 'Sign in', href: '/auth/candidate/login', variant: 'outline-white' },
    ],
  },
  footer: {
    brandDescription:
      'A conversational hiring experience for verified talent and clearer connections.',
    tagline: 'Made for verified talent',
    columns: [
      {
        title: 'For candidates',
        links: [
          { label: 'Create profile', href: '/signup?role=candidate' },
          { label: 'Candidate login', href: '/auth/candidate/login' },
        ],
      },
      {
        title: 'For recruiters',
        links: [
          { label: 'Start hiring', href: '/signup?role=recruiter' },
          { label: 'Recruiter login', href: '/auth/recruiter/login' },
        ],
      },
    ],
    copyright: '© 2026, TechSalesAxis.com The Next Big Idea Technologies Pvt. Ltd . All rights reserved.',
    madeFor: 'Made for verified talent',
  },
};
