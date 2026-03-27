"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let isInit = false;
    async function checkExistingSession() {
      if (isInit) return;
      isInit = true;

      const token = awsAuth.getToken();
      if (token) {
        try {
          const handshake = await apiClient.get(
            "/auth/post-login",
            token,
          );
          if (handshake && handshake.next_step) {
            router.replace(handshake.next_step);
          }
        } catch (err) {
          console.error("Handshake failed:", err);
          // Stay on landing if handshake fails
        }
      }
    }
    checkExistingSession();
  }, [router]);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-2xl">
              <div className="h-5 w-5 rounded bg-white rotate-45" />
            </div>
            <span className="text-xl font-black tracking-tighter text-slate-900 uppercase">
              TechSales Axis
            </span>
          </div>

          <div className="hidden md:flex items-center gap-10 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Link
              href="#logic"
              className="hover:text-slate-900 transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="#trust"
              className="hover:text-slate-900 transition-colors"
            >
              Why Trust Us
            </Link>
            <Link
              href="/login"
              className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-48 pb-32 overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 lg:px-12 relative z-10">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 mb-8">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
                  Skill-Verified Network
                </span>
              </div>

              <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.9] mb-8">
                HIRE ON <span className="text-blue-600">TALENT</span>,<br />
                NOT GUESSWORK.
              </h1>

              <p className="text-xl md:text-2xl text-slate-500 font-medium leading-relaxed max-w-2xl mb-12">
                The trusted home for professional talent. We verify skills
                through simple AI conversations, ensuring a perfect fit for
                every team.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Link
                  href="/signup?role=candidate"
                  className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 group"
                >
                  Join as Candidate
                  <svg
                    className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
                <Link
                  href="/signup?role=recruiter"
                  className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 border-slate-100 hover:border-slate-900 transition-all flex items-center justify-center"
                >
                  Join as Recruiter
                </Link>
              </div>
            </div>
          </div>

          {/* Background Grid */}
          <div className="absolute top-0 right-0 w-1/2 h-full -z-10 opacity-5">
            <div
              className="w-full h-full"
              style={{
                backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>
        </section>

        {/* The Logic Section */}
        <section id="logic" className="py-32 bg-slate-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mb-20">
              <h2 className="text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
                How TechSales Axis Works
              </h2>
              <div className="h-1.5 w-24 bg-blue-600 mt-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-6">
                <span className="text-5xl font-black text-slate-200 tabular-nums">
                  01
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tight">
                  Verified Identity
                </h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                  We don&apos;t just accept profiles. Every candidate undergoes
                  identity verification and professional screening before they
                  see a single job.
                </p>
              </div>

              <div className="space-y-6">
                <span className="text-5xl font-black text-slate-200 tabular-nums">
                  02
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tight">
                  Verified Skills
                </h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                  Our AI interviewer evaluates depth and experience through
                  natural conversations. We measure what truly matters in a
                  role.
                </p>
              </div>

              <div className="space-y-6">
                <span className="text-5xl font-black text-slate-200 tabular-nums">
                  03
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tight">
                  Spam-Free Hiring
                </h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                  No cold messages. No generic applications. The network is
                  built on skill-based visibility, ensuring every match is a
                  real opportunity.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Shield Section */}
        <section id="trust" className="py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="bg-slate-900 rounded-[3rem] p-12 md:p-24 text-white relative overflow-hidden shadow-2xl">
              <div className="relative z-10 max-w-3xl">
                <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none mb-8">
                  HIRE FASTER, <br />
                  <span className="text-blue-500">HIRE BETTER.</span>
                </h2>
                <p className="text-xl text-slate-400 font-medium mb-12">
                  Stop scanning resumes. Start seeing potential. Our verified
                  network reduces your hiring time by 70% by pre-verifying every
                  candidate beforehand.
                </p>
                <div className="flex flex-wrap gap-8 items-center pt-8 border-t border-slate-800">
                  <div>
                    <div className="text-3xl font-black tabular-nums">100%</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Verified Profiles
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black tabular-nums">0.0%</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Spam Policy
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black tabular-nums">16+</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Skill Metrics
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative Element */}
              <div className="absolute right-0 bottom-0 opacity-10">
                <svg
                  className="w-100 h-100"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M50 0L60 40L100 50L60 60L50 100L40 60L0 50L40 40L50 0Z"
                    fill="white"
                  />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Simple Footer */}
        <footer className="py-20 border-t border-slate-100">
          <div className="mx-auto max-w-7xl px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3 grayscale opacity-50">
              <div className="h-6 w-6 rounded bg-slate-900" />
              <span className="text-sm font-black tracking-tighter uppercase italic">
                TechSales Axis
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              © 2026 TechSales Axis. All Rights Reserved.
            </p>
            <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Link href="#" className="hover:text-slate-900 transition-colors">
                Trust Policy
              </Link>
              <Link href="#" className="hover:text-slate-900 transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
