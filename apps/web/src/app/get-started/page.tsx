'use client';
import Link from 'next/link';

const roleCards = [
  {
    id: 'candidate',
    title: "I'm a Candidate",
    description: 'Find your next opportunity through AI-powered matching and real conversations.',
    cta: 'Get started',
    href: '/signup?role=candidate',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'recruiter',
    title: "I'm a Recruiter",
    description: 'Hire verified talent with AI discovery and manage your entire hiring pipeline.',
    cta: 'Start hiring',
    href: '/signup?role=recruiter',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 18v-1a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function GetStartedPage() {
  return (
    <main className="get-started-container">
      <div className="get-started-content">
        <div className="kicker">Choose your path</div>
        <h1>Join TechSalesAxis</h1>
        <p className="subtitle">Are you looking for a job or hiring talent?</p>

        <div className="role-selection">
          {roleCards.map((role) => (
            <Link key={role.id} href={role.href} className="role-card">
              <div className="role-card-body">
                <span className="role-icon">{role.icon}</span>
                <h2>{role.title}</h2>
                <p>{role.description}</p>
              </div>
              <span className="btn-role">{role.cta}</span>
            </Link>
          ))}
        </div>

        <p className="signin-link">
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </p>
      </div>

      <style jsx>{`
        .get-started-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 10% 10%, rgba(255, 152, 0, 0.14) 0%, transparent 30%),
            radial-gradient(circle at 90% 80%, rgba(255, 152, 0, 0.1) 0%, transparent 34%),
            linear-gradient(135deg, #fffaf5 0%, #fff4e6 100%);
          padding: 1.35rem 1.25rem;
        }

        .get-started-content {
          max-width: 920px;
          width: 100%;
          text-align: center;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(255, 152, 0, 0.25);
          border-radius: 1rem;
          padding: 1.45rem 1.5rem;
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.08);
        }

        .kicker {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.6rem;
        }

        .get-started-content h1 {
          font-size: 1.72rem;
          font-weight: 800;
          color: #000;
          margin-bottom: 0.45rem;
          line-height: 1.2;
        }

        .subtitle {
          font-size: 0.94rem;
          color: #4b5563;
          margin-bottom: 1.35rem;
        }

        .role-selection {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.95rem;
          margin-bottom: 1.1rem;
          align-items: stretch;
        }

        .role-card {
          padding: 1.1rem 1.15rem 1rem;
          background: linear-gradient(180deg, #ffffff 0%, #fff8ee 100%);
          border: 1px solid rgba(255, 152, 0, 0.5);
          border-radius: 0.95rem;
          transition: all 0.3s ease;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          min-height: 220px;
          gap: 1.15rem;
        }

        .role-card-body {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          gap: 0.55rem;
          width: 100%;
          padding-bottom: 0.35rem;
        }

        .role-card:hover {
          box-shadow: 0 14px 28px rgba(255, 152, 0, 0.2);
          transform: translateY(-4px);
          border-color: #ff6f00;
        }

        .role-icon {
          width: 2.55rem;
          height: 2.55rem;
          margin: 0 auto 0.7rem;
          border-radius: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #111 0%, #2f2f2f 100%);
          border: 1px solid rgba(255, 152, 0, 0.45);
          color: #ff9800;
          box-shadow: 0 8px 18px rgba(255, 152, 0, 0.2);
        }

        .role-icon :global(svg) {
          width: 1.2rem;
          height: 1.2rem;
        }

        .role-card h2 {
          font-size: 1.12rem;
          font-weight: 700;
          color: #000;
          margin: 0;
          line-height: 1.2;
        }

        .role-card p {
          font-size: 0.84rem;
          color: #4b5563;
          line-height: 1.4;
          margin: 0.15rem 0 0;
          max-width: 33ch;
          min-height: 2.75rem;
        }

        .role-card :global(h2),
        .role-card :global(p) {
          width: 100%;
        }

        .btn-role {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
          color: white;
          border: none;
          padding: 0.62rem 1.15rem;
          border-radius: 0.45rem;
          font-weight: 700;
          font-size: 0.875rem;
          margin-top: auto;
          transition: all 0.3s ease;
          min-width: 7.85rem;
          text-align: center;
          margin-top: 1.75rem;
        }

        .role-card:hover .btn-role {
          box-shadow: 0 8px 22px rgba(255, 152, 0, 0.3);
          transform: translateY(-3px);
        }

        .signin-link {
          font-size: 0.95rem;
          color: #4b5563;
        }

        .signin-link :global(a) {
          color: #ff9800;
          text-decoration: none;
          font-weight: 700;
        }

        .signin-link :global(a:hover) {
          color: #ff6f00;
        }

        @media (max-width: 768px) {
          .get-started-content {
            padding: 1.25rem 1rem;
          }

          .get-started-content h1 {
            font-size: 1.55rem;
          }

          .role-selection {
            grid-template-columns: 1fr;
          }

          .role-card {
            min-height: auto;
            gap: 1rem;
          }

          .btn-role {
            margin-top: 1.1rem;
          }

          .role-card p {
            max-width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
