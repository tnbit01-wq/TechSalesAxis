'use client';
import { useRouter } from 'next/navigation';

export default function GetStartedPage() {
  const router = useRouter();

  return (
    <div className="get-started-container">
      <div className="get-started-content">
        <h1>Join TechSalesAxis</h1>
        <p>Are you looking for a job or hiring talent?</p>

        <div className="role-selection">
          <div className="role-card" onClick={() => router.push('/signup?role=candidate')}>
            <div className="role-icon role-icon-candidate">C</div>
            <h2>I'm a Candidate</h2>
            <p>Find your next opportunity through AI-powered matching and real conversations.</p>
            <button className="btn btn-role">Get Started</button>
          </div>

          <div className="role-card" onClick={() => router.push('/signup?role=recruiter')}>
            <div className="role-icon role-icon-recruiter">R</div>
            <h2>I'm a Recruiter</h2>
            <p>Hire verified talent with AI discovery and manage your entire hiring pipeline.</p>
            <button className="btn btn-role">Start Hiring</button>
          </div>
        </div>

        <p className="signin-link">
          Already have an account?{' '}
          <a href="/auth/candidate/login">Sign in</a>
        </p>
      </div>

      <style jsx>{`
        .get-started-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #fff9f5 0%, #fff5eb 100%);
          padding: 2rem;
        }

        .get-started-content {
          max-width: 900px;
          width: 100%;
          text-align: center;
        }

        .get-started-content h1 {
          font-size: 2.5rem;
          font-weight: 900;
          color: #000;
          margin-bottom: 0.5rem;
        }

        .get-started-content > p {
          font-size: 1.125rem;
          color: #666;
          margin-bottom: 3rem;
        }

        .role-selection {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-bottom: 3rem;
        }

        .role-card {
          padding: 2rem;
          background: white;
          border: 2px solid #ff9800;
          border-radius: 1rem;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .role-card:hover {
          box-shadow: 0 10px 30px rgba(255, 152, 0, 0.3);
          transform: translateY(-8px);
          border-color: #ff6f00;
        }

        .role-icon {
          width: 4rem;
          height: 4rem;
          margin: 0 auto 1rem;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .role-icon-candidate {
          background: linear-gradient(135deg, #000 0%, #ff9800 100%);
          color: white;
        }

        .role-icon-recruiter {
          background: #fff5eb;
          color: #000;
          border: 2px solid #ff9800;
        }

        .role-card h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #000;
          margin-bottom: 0.75rem;
        }

        .role-card p {
          font-size: 0.875rem;
          color: #666;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .btn-role {
          background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
          color: white;
          border: none;
          padding: 0.75rem 2rem;
          border-radius: 0.5rem;
          font-weight: 700;
          cursor: pointer;
          font-size: 0.875rem;
          text-transform: uppercase;
          transition: all 0.3s ease;
        }

        .btn-role:hover {
          box-shadow: 0 10px 30px rgba(255, 152, 0, 0.4);
          transform: translateY(-3px);
        }

        .signin-link {
          font-size: 0.875rem;
          color: #666;
        }

        .signin-link a {
          color: #ff9800;
          text-decoration: none;
          font-weight: 700;
        }

        .signin-link a:hover {
          color: #ff6f00;
        }

        @media (max-width: 768px) {
          .get-started-content h1 {
            font-size: 2rem;
          }

          .role-selection {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
