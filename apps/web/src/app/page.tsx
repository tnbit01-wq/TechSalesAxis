"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

export default function Home() {
  const router = useRouter();
  const [showRegisterModal, setShowRegisterModal] = useState(false);

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

  const handleRegisterRole = (role: "candidate" | "recruiter") => {
    setShowRegisterModal(false);
    router.push(`/signup?role=${role}`);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Register Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 p-8 animate-in fade-in scale-95">
            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Join TechSales Axis</h2>
              <p className="text-slate-500 font-medium">Select how you want to join our platform</p>
            </div>

            <div className="space-y-4">
              {/* Candidate Option */}
              <button
                onClick={() => handleRegisterRole("candidate")}
                className="w-full p-6 border-2 border-slate-200 rounded-2xl hover:border-blue-600 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                    <svg className="w-6 h-6 text-blue-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">I'm a Candidate</h3>
                    <p className="text-sm text-slate-500 mt-1">Showcase your skills and find your next role</p>
                  </div>
                </div>
              </button>

              {/* Recruiter Option */}
              <button
                onClick={() => handleRegisterRole("recruiter")}
                className="w-full p-6 border-2 border-slate-200 rounded-2xl hover:border-emerald-600 hover:bg-emerald-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                    <svg className="w-6 h-6 text-emerald-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">I'm a Recruiter</h3>
                    <p className="text-sm text-slate-500 mt-1">Build your hiring team and find perfect matches</p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowRegisterModal(false)}
              className="w-full mt-6 py-3 text-center text-slate-500 font-bold hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
              href="#features"
              className="hover:text-slate-900 transition-colors"
            >
              Features
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
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
            >
              Register
            </button>
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

              <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-slate-900 leading-[0.95] mb-8">
                HIRE ON <span className="text-blue-600">TALENT</span>,<br />
                NOT GUESSWORK.
              </h1>

              <p className="text-xl md:text-2xl text-slate-600 font-medium leading-relaxed max-w-2xl mb-12">
                The trusted home for verified professional talent. We authenticate skills through intelligent conversations, ensuring every match is built on real capability—not hope.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 group"
                >
                  Get Started
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
                </button>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-10 py-5 bg-white text-slate-900 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 border-slate-100 hover:border-slate-900 transition-all flex items-center justify-center"
                >
                  Sign In
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-8 mt-20 pt-12 border-t border-slate-100">
                <div>
                  <div className="text-3xl font-black text-slate-900">100%</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Verified Profiles</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900">16+</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Skill Metrics</div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900">0.0%</div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Spam Policy</div>
                </div>
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
              <h2 className="text-5xl font-black tracking-tighter text-slate-900 uppercase">
                How TechSales Axis Works
              </h2>
              <div className="h-1.5 w-24 bg-blue-600 mt-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-6 group">
                <div className="h-16 w-16 rounded-2xl bg-blue-100 group-hover:bg-blue-600 transition-colors flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Verified Identity</h3>
                <p className="text-slate-600 leading-relaxed font-medium">
                  We don&apos;t just accept profiles. Every candidate undergoes identity verification, background screening, and professional validation before accessing opportunities.
                </p>
              </div>

              <div className="space-y-6 group">
                <div className="h-16 w-16 rounded-2xl bg-emerald-100 group-hover:bg-emerald-600 transition-colors flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Skill Authentication</h3>
                <p className="text-slate-600 leading-relaxed font-medium">
                  Our AI-powered assessment engine evaluates experience depth and technical capability through natural conversation, measuring what truly matters for your role.
                </p>
              </div>

              <div className="space-y-6 group">
                <div className="h-16 w-16 rounded-2xl bg-purple-100 group-hover:bg-purple-600 transition-colors flex items-center justify-center">
                  <svg className="w-8 h-8 text-purple-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Smart Matching</h3>
                <p className="text-slate-600 leading-relaxed font-medium">
                  No spam. No generic applications. Every connection is skill-based and intentional, ensuring high-quality matches between verified talent and real opportunities.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mb-20">
              <h2 className="text-5xl font-black tracking-tighter text-slate-900 uppercase">
                Powerful Features for Modern Hiring
              </h2>
              <div className="h-1.5 w-24 bg-blue-600 mt-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Feature 1 */}
              <div className="p-8 rounded-2xl border border-slate-200 hover:border-blue-600 hover:shadow-lg transition-all group">
                <div className="h-12 w-12 rounded-xl bg-blue-100 group-hover:bg-blue-600 transition-colors flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Real-Time Skill Assessment</h3>
                <p className="text-slate-600 font-medium">Experience-based evaluation through natural AI conversations, not traditional tests. Measure actual expertise in real-world context.</p>
              </div>

              {/* Feature 2 */}
              <div className="p-8 rounded-2xl border border-slate-200 hover:border-emerald-600 hover:shadow-lg transition-all group">
                <div className="h-12 w-12 rounded-xl bg-emerald-100 group-hover:bg-emerald-600 transition-colors flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-emerald-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Anti-Spam Protection</h3>
                <p className="text-slate-600 font-medium">100% verified profiles mean zero spam, no bot applications, and no wasted time sifting through low-quality matches.</p>
              </div>

              {/* Feature 3 */}
              <div className="p-8 rounded-2xl border border-slate-200 hover:border-purple-600 hover:shadow-lg transition-all group">
                <div className="h-12 w-12 rounded-xl bg-purple-100 group-hover:bg-purple-600 transition-colors flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Fast Verification Pipeline</h3>
                <p className="text-slate-600 font-medium">Pre-vetted candidates mean 70% faster hiring cycles. Start conversations with qualified professionals, not tire-kickers.</p>
              </div>

              {/* Feature 4 */}
              <div className="p-8 rounded-2xl border border-slate-200 hover:border-pink-600 hover:shadow-lg transition-all group">
                <div className="h-12 w-12 rounded-xl bg-pink-100 group-hover:bg-pink-600 transition-colors flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-pink-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Voice & Text Flexibility</h3>
                <p className="text-slate-600 font-medium">Candidates can showcase their communication style naturally—through voice, text, or both. We capture how they actually work.</p>
              </div>

              {/* Feature 5 */}
              <div className="p-8 rounded-2xl border border-slate-200 hover:border-orange-600 hover:shadow-lg transition-all group">
                <div className="h-12 w-12 rounded-xl bg-orange-100 group-hover:bg-orange-600 transition-colors flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-orange-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Detailed Analytics Dashboard</h3>
                <p className="text-slate-600 font-medium">Track hiring metrics, skill distribution, assessment scores, and hiring velocity all in one place for data-driven decisions.</p>
              </div>

              {/* Feature 6 */}
              <div className="p-8 rounded-2xl border border-slate-200 hover:border-cyan-600 hover:shadow-lg transition-all group">
                <div className="h-12 w-12 rounded-xl bg-cyan-100 group-hover:bg-cyan-600 transition-colors flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-cyan-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Organization & Team Management</h3>
                <p className="text-slate-600 font-medium">Build teams, manage access levels, and collaborate seamlessly across your entire organization with role-based controls.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Candidate Benefits Section */}
        <section className="py-32 bg-gradient-to-br from-blue-50 to-cyan-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-5xl font-black tracking-tighter text-slate-900 mb-8">For Candidates</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">Showcase Real Skills</h3>
                      <p className="text-slate-600">Demonstrate your expertise through conversations, not just resume keywords.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">Zero Spam, Genuine Opportunities</h3>
                      <p className="text-slate-600">Only connect with serious recruiters hiring verified, quality positions.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">Fast-Track Hiring Process</h3>
                      <p className="text-slate-600">Skip the resume screening phase—get straight to meeting with decision makers.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">Flexible Communication</h3>
                      <p className="text-slate-600">Use voice, text, or both to communicate naturally. There's no wrong way.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-12 shadow-2xl">
                <div className="space-y-6">
                  <div className="h-64 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-32 h-32 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                    </svg>
                  </div>
                  <p className="text-center text-slate-600 font-medium">Join a verified community of talented professionals trusted by top companies.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recruiter Benefits Section */}
        <section className="py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div className="md:order-2">
                <h2 className="text-5xl font-black tracking-tighter text-slate-900 mb-8">For Recruiters</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">70% Faster Hiring</h3>
                      <p className="text-slate-600">Pre-vetted candidates mean you skip screening and focus on quality conversations.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">100% Verified Talent</h3>
                      <p className="text-slate-600">Every candidate verified for identity, skills, and cultural fit. No time wasters.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">Build Your Culture Profile</h3>
                      <p className="text-slate-600">Define your company culture, values, and hiring criteria for smarter matching.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 mb-1">Advanced Analytics</h3>
                      <p className="text-slate-600">Track metrics that matter: time-to-hire, candidate quality, and team performance.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:order-1 bg-white rounded-3xl p-12 shadow-2xl">
                <div className="space-y-6">
                  <div className="h-64 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-32 h-32 text-emerald-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-2-13h4v6h-4z" />
                    </svg>
                  </div>
                  <p className="text-center text-slate-600 font-medium">Build your dream team with candidates who are verified, capable, and culturally aligned.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Shield Section */}
        <section id="trust" className="py-32 bg-slate-50">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="bg-slate-900 rounded-[3rem] p-12 md:p-24 text-white relative overflow-hidden shadow-2xl">
              <div className="relative z-10 max-w-3xl">
                <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-tight mb-8">
                  HIRE FASTER,<br />
                  <span className="text-blue-500">HIRE BETTER.</span>
                </h2>
                <p className="text-xl text-slate-300 font-medium mb-12">
                  Stop scanning resumes. Start seeing potential. Our verified network reduces your hiring time by 70% by pre-verifying every candidate beforehand. Only communicate with professionals who can actually contribute.
                </p>
                <div className="flex flex-wrap gap-12 items-center pt-8 border-t border-slate-800">
                  <div>
                    <div className="text-4xl font-black tabular-nums">100%</div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">
                      Identity Verified
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-black tabular-nums">16+</div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">
                      Skill Dimensions
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-black tabular-nums">70%</div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">
                      Time Reduction
                    </div>
                  </div>
                  <div>
                    <div className="text-4xl font-black tabular-nums">0.0%</div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">
                      Spam Rate
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

        {/* CTA Section */}
        <section className="py-32">
          <div className="mx-auto max-w-4xl px-6 lg:px-12 text-center">
            <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-slate-900 mb-8">
              Ready to Transform Your Hiring?
            </h2>
            <p className="text-xl text-slate-600 font-medium mb-12 max-w-2xl mx-auto">
              Join hundreds of companies and talented professionals already using TechSales Axis to build better teams.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button
                onClick={() => setShowRegisterModal(true)}
                className="px-10 py-5 bg-slate-900 text-white text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-blue-600 transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 group"
              >
                Start Hiring Today
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
              </button>
              <Link
                href="/login"
                className="px-10 py-5 bg-white text-slate-900 text-sm font-bold uppercase tracking-widest rounded-2xl border-2 border-slate-100 hover:border-slate-900 transition-all"
              >
                Sign In
              </Link>
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
              © 2026 TechSales Axis. All Rights Reserved. Verified Talent for Verified Results.
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
