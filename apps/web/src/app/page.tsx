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
          const handshake = await apiClient.get("/auth/post-login", token);
          if (handshake && handshake.next_step) {
            router.replace(handshake.next_step);
          }
        } catch (err) {
          console.error("Handshake failed:", err);
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
              <p className="text-slate-500 font-medium">Choose your path to success</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => handleRegisterRole("candidate")}
                className="w-full p-6 border-2 border-slate-200 rounded-2xl hover:border-blue-600 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">I'm a Candidate</h3>
                    <p className="text-sm text-slate-500 mt-1">Find roles matched to your skills</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleRegisterRole("recruiter")}
                className="w-full p-6 border-2 border-slate-200 rounded-2xl hover:border-emerald-600 hover:bg-emerald-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 transition-colors flex-shrink-0">
                    <svg className="w-6 h-6 text-emerald-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">I'm a Recruiter</h3>
                    <p className="text-sm text-slate-500 mt-1">Discover pre-vetted talent pools</p>
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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-lg">
              <div className="h-4 w-4 rounded bg-white rotate-45" />
            </div>
            <span className="text-lg font-black tracking-tighter text-slate-900 uppercase">
              TechSales Axis
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-600">
            <Link href="#how" className="hover:text-slate-900 transition-colors">Features</Link>
            <Link href="#candidates" className="hover:text-slate-900 transition-colors">Candidates</Link>
            <Link href="#recruiters" className="hover:text-slate-900 transition-colors">Recruiters</Link>
            <Link href="#why-us" className="hover:text-slate-900 transition-colors">Why Choose Us</Link>
            <Link href="/login" className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-blue-600 transition-all shadow-lg">Sign In</Link>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg"
            >
              Register
            </button>
          </div>
        </div>
      </nav>

      <main>
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideInLeft {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes float {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          .animate-fadeInUp {
            animation: fadeInUp 0.6s ease-out forwards;
          }
          .animate-slideInLeft {
            animation: slideInLeft 0.6s ease-out forwards;
          }
          .animate-slideInRight {
            animation: slideInRight 0.6s ease-out forwards;
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
          .animation-delay-1 {
            animation-delay: 0.1s;
          }
          .animation-delay-2 {
            animation-delay: 0.2s;
          }
          .animation-delay-3 {
            animation-delay: 0.3s;
          }
          .animation-delay-4 {
            animation-delay: 0.4s;
          }
        `}</style>
        {/* Hero Section - Rich & Compact */}
        <section className="relative pt-24 pb-10 overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 lg:px-12 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 mb-6 animate-fadeInUp">
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-blue-700">Conversational Hiring Platform</span>
                </div>

                <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-slate-900 leading-[1] mb-4 animate-fadeInUp animation-delay-1">
                  Verified Talent.<br/>
                  Real Connections.
                </h1>

                <p className="text-base text-slate-700 font-semibold mb-3 leading-snug animate-fadeInUp animation-delay-2">
                  AI-powered matching through natural conversations. No spam, no guesswork—just skill-verified professionals connecting with opportunities that matter.
                </p>
                
                <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
                  <div className="flex gap-2 animate-fadeInUp animation-delay-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-700 font-medium">Chat-based onboarding</span>
                  </div>
                  <div className="flex gap-2 animate-fadeInUp animation-delay-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-700 font-medium">5-factor AI matching</span>
                  </div>
                  <div className="flex gap-2 animate-fadeInUp animation-delay-3">
                    <span className="h-2 w-2 rounded-full bg-purple-600 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-700 font-medium">Integrated interviews</span>
                  </div>
                  <div className="flex gap-2 animate-fadeInUp animation-delay-3">
                    <span className="h-2 w-2 rounded-full bg-orange-600 mt-2 flex-shrink-0"></span>
                    <span className="text-slate-700 font-medium">Talent visualization</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 animate-fadeInUp animation-delay-4">
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:shadow-2xl hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 group hover:scale-105"
                  >
                    Start Now
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  <Link
                    href="/login"
                    className="w-full sm:w-auto px-7 py-3 bg-slate-100 text-slate-900 text-xs font-black uppercase tracking-widest rounded-lg border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-200 transition-all flex items-center justify-center hover:scale-105"
                  >
                    Sign In
                  </Link>
                </div>
              </div>

              <div className="relative hidden lg:block animate-slideInRight">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-emerald-600/10 rounded-3xl blur-3xl animate-float" />
                <div className="relative bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 pb-3 border-b border-blue-200">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <span className="text-xs font-black text-blue-600">✓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-700 uppercase">Identity Verified</p>
                        <p className="text-xs text-slate-600 mt-0.5">Background checked & authenticated</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pb-3 border-b border-blue-200">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <span className="text-xs font-black text-emerald-600">✓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-700 uppercase">Skill Authenticated</p>
                        <p className="text-xs text-slate-600 mt-0.5">AI-assessed through conversations</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <span className="text-xs font-black text-purple-600">✓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-700 uppercase">Career Ready</p>
                        <p className="text-xs text-slate-600 mt-0.5">Availability & job search intent clear</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-600/10 to-transparent rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-gradient-to-tr from-emerald-600/10 to-transparent rounded-full blur-3xl -z-10" />
          </div>
        </section>

        {/* Core Platform Features - Compact Grid */}
        <section id="how" className="py-10 bg-slate-50 border-y border-slate-200 animate-fadeInUp">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mb-10">
              <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase animate-slideInLeft">
                Powered By Real Technology
              </h2>
              <p className="text-sm text-slate-600 font-semibold mt-2 animate-slideInLeft animation-delay-1">
                Every feature is implemented and actively used. No vapor promises.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Feature 1 */}
              <div className="p-5 bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all group animate-fadeInUp animation-delay-1 hover:scale-105 hover:shadow-lg">
                <div className="h-10 w-10 rounded-lg bg-blue-100 group-hover:bg-blue-500 transition-colors flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Conversational AI</h3>
                <p className="text-xs text-slate-600 leading-snug">Chat-like profile building. Natural language understanding. No boring forms.</p>
              </div>

              {/* Feature 2 */}
              <div className="p-5 bg-white rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group animate-fadeInUp animation-delay-2 hover:scale-105 hover:shadow-lg">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 group-hover:bg-emerald-500 transition-colors flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Smart Matching</h3>
                <p className="text-xs text-slate-600 leading-snug">Multi-factor algorithm. Skills, experience, location, salary, role fit.</p>
              </div>

              {/* Feature 3 */}
              <div className="p-5 bg-white rounded-lg border border-slate-200 hover:border-purple-400 hover:bg-purple-50 transition-all group animate-fadeInUp animation-delay-3 hover:scale-105 hover:shadow-lg">
                <div className="h-10 w-10 rounded-lg bg-purple-100 group-hover:bg-purple-500 transition-colors flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-purple-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Talent Visualization</h3>
                <p className="text-xs text-slate-600 leading-snug">D3.js bubble charts. See talent by experience, location, tier.</p>
              </div>

              {/* Feature 4 */}
              <div className="p-5 bg-white rounded-lg border border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-all group animate-fadeInUp animation-delay-4 hover:scale-105 hover:shadow-lg">
                <div className="h-10 w-10 rounded-lg bg-orange-100 group-hover:bg-orange-500 transition-colors flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-orange-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Interview Integration</h3>
                <p className="text-xs text-slate-600 leading-snug">Propose times. Auto-Jitsi links. Real-time scheduling.</p>
              </div>

              {/* Feature 5 */}
              <div className="p-5 bg-white rounded-lg border border-slate-200 hover:border-rose-400 hover:bg-rose-50 transition-all group animate-fadeInUp animation-delay-1 hover:scale-105 hover:shadow-lg">
                <div className="h-10 w-10 rounded-lg bg-rose-100 group-hover:bg-rose-500 transition-colors flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-rose-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Direct Chat</h3>
                <p className="text-xs text-slate-600 leading-snug">Thread-based messaging. Real-time conversations. No delays.</p>
              </div>

              {/* Feature 6 */}
              <div className="p-5 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group animate-fadeInUp animation-delay-2 hover:scale-105 hover:shadow-lg">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 group-hover:bg-indigo-500 transition-colors flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Analytics & Insights</h3>
                <p className="text-xs text-slate-600 leading-snug">Hiring funnel. Talent distribution. Real metrics.</p>
              </div>

              {/* Feature 7 */}
              <div className="p-5 bg-white rounded-lg border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50 transition-all group animate-fadeInUp animation-delay-3 hover:scale-105 hover:shadow-lg">
                <div className="h-10 w-10 rounded-lg bg-cyan-100 group-hover:bg-cyan-500 transition-colors flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-cyan-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Team Management</h3>
                <p className="text-xs text-slate-600 leading-snug">Role-based access. Multi-recruiter collaboration.</p>
              </div>

              {/* Feature 8 */}
              <div className="p-5 bg-white rounded-lg border border-slate-200 hover:border-pink-400 hover:bg-pink-50 transition-all group animate-fadeInUp animation-delay-4 hover:scale-105 hover:shadow-lg">
                <div className="h-10 w-10 rounded-lg bg-pink-100 group-hover:bg-pink-500 transition-colors flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-pink-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Proctored Assessment</h3>
                <p className="text-xs text-slate-600 leading-snug">Cheating detection. Tab-switch bans. Verified scores.</p>
              </div>
            </div>
          </div>
        </section>

        {/* For Candidates - Compact */}
        <section id="candidates" className="py-10 animate-fadeInUp">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              <div>
                <div className="inline-block px-4 py-1.5 bg-blue-100 rounded-full mb-4 animate-slideInLeft">
                  <span className="text-xs font-black text-blue-700 uppercase">For Candidates</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-5 animate-slideInLeft animation-delay-1">Stop Applying Blind</h2>
                <p className="text-sm text-slate-700 font-semibold mb-6 animate-slideInLeft animation-delay-2">
                  Your skills matter. Our AI matches you with roles where you'll actually succeed. 
                </p>
                <ul className="space-y-3">
                  <li className="flex gap-3 animate-fadeInUp">
                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Conversational Profile</p>
                      <p className="text-xs text-slate-600">Chat about your experience, not fill forms</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-1">
                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Smart Job Recs</p>
                      <p className="text-xs text-slate-600">Matched to jobs where skills fit perfectly</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Zero Spam</p>
                      <p className="text-xs text-slate-600">Only verified companies with real roles</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-3">
                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Direct Chat</p>
                      <p className="text-xs text-slate-600">Real-time messaging with recruiters</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-4">
                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Interview Simplified</p>
                      <p className="text-xs text-slate-600">Propose times, we handle coordination</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-1">
                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Career Insights</p>
                      <p className="text-xs text-slate-600">Readiness data & personalized guidance</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="relative animate-slideInRight">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl opacity-10 blur-2xl animate-float" />
                <div className="relative bg-white rounded-xl p-6 border border-blue-200 shadow-lg">
                  <p className="text-xs font-black text-slate-500 uppercase mb-4 tracking-wider">Your Matched Opportunities</p>
                  <div className="space-y-2.5">
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100 hover:border-blue-300 transition-all group cursor-pointer animate-fadeInUp hover:scale-105 hover:shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-black text-slate-900">Senior Sales Engineer</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">TechCorp • Full-time</p>
                        </div>
                        <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform">✓</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden mr-2">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{width: '92%'}}></div>
                        </div>
                        <span className="text-[10px] font-black text-green-600 whitespace-nowrap">92%</span>
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100 hover:border-amber-300 transition-all group cursor-pointer animate-fadeInUp animation-delay-1 hover:scale-105 hover:shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-black text-slate-900">Sales Development Rep</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Growth Co • Full-time</p>
                        </div>
                        <div className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform">✓</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden mr-2">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{width: '78%'}}></div>
                        </div>
                        <span className="text-[10px] font-black text-amber-600 whitespace-nowrap">78%</span>
                      </div>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100 hover:border-purple-300 transition-all group cursor-pointer animate-fadeInUp animation-delay-2 hover:scale-105 hover:shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-black text-slate-900">Enterprise Account Exec</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">EnterpriseCo • Full-time</p>
                        </div>
                        <div className="h-6 w-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform">✓</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden mr-2">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{width: '85%'}}></div>
                        </div>
                        <span className="text-[10px] font-black text-purple-600 whitespace-nowrap">85%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-600 font-semibold text-center">2 recruiters messaged you recently</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* For Recruiters - Compact */}
        <section id="recruiters" className="py-10 bg-slate-50 animate-fadeInUp">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              <div className="relative order-2 lg:order-1 animate-slideInLeft">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl opacity-10 blur-2xl animate-float" />
                <div className="relative bg-white rounded-xl p-6 border border-emerald-200 shadow-lg">
                  <p className="text-xs font-black text-slate-500 uppercase mb-4 tracking-wider">Talent Pool Visualization</p>
                  <div className="space-y-4">
                    <div className="space-y-1 animate-fadeInUp">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Senior Level</span>
                        <span className="text-[10px] font-black text-emerald-600">45 candidates</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{width: '85%'}}></div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <span className="text-[8px] px-2 py-0.5 bg-emerald-100 text-emerald-700 font-black rounded">Sales Eng - 12</span>
                        <span className="text-[8px] px-2 py-0.5 bg-teal-100 text-teal-700 font-black rounded">SDR - 8</span>
                        <span className="text-[8px] px-2 py-0.5 bg-cyan-100 text-cyan-700 font-black rounded">AE - 25</span>
                      </div>
                    </div>

                    <div className="space-y-1 animate-fadeInUp animation-delay-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Mid Level</span>
                        <span className="text-[10px] font-black text-emerald-600">68 candidates</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 rounded-full" style={{width: '92%'}}></div>
                      </div>
                    </div>

                    <div className="space-y-1 animate-fadeInUp animation-delay-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Entry Level</span>
                        <span className="text-[10px] font-black text-emerald-600">34 candidates</span>
                      </div>
                      <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-300 to-teal-200 rounded-full" style={{width: '58%'}}></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-5 border-t border-slate-200 animate-fadeInUp animation-delay-3">
                    <p className="text-xs font-black text-slate-900 mb-3">Top Match This Week</p>
                    <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 hover:shadow-lg hover:scale-105 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-xs font-black text-slate-900">Sarah Chen</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">8 yrs Sales Engineering • Available Now</p>
                        </div>
                        <span className="text-xs font-black text-white bg-emerald-600 px-2 py-1 rounded">87%</span>
                      </div>
                      <p className="text-[10px] text-slate-600 mb-2">Last conversation: "Looking for leadership opportunities in Q3"</p>
                      <button className="w-full text-[10px] font-black text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors py-1.5 rounded">MESSAGE CANDIDATE</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2 animate-slideInRight">
                <div className="inline-block px-4 py-1.5 bg-emerald-100 rounded-full mb-4 animate-slideInRight">
                  <span className="text-xs font-black text-emerald-700 uppercase">For Recruiters</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-5 animate-slideInRight animation-delay-1">Hire Quality, Not Volume</h2>
                <p className="text-sm text-slate-700 font-semibold mb-6 animate-slideInRight animation-delay-2">
                  Pre-vetted talent. AI-powered discovery. One-platform hiring.
                </p>
                <ul className="space-y-3">
                  <li className="flex gap-3 animate-fadeInUp">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">AI Talent Discovery</p>
                      <p className="text-xs text-slate-600">Visualize & filter talent pools in seconds</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Conversation History</p>
                      <p className="text-xs text-slate-600">Understand career intent & readiness</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Pre-Vetted Only</p>
                      <p className="text-xs text-slate-600">100% identity verified, no spam</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Integrated Pipeline</p>
                      <p className="text-xs text-slate-600">Jobs, apps, interviews, offers all in one</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-4">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Direct Messaging</p>
                      <p className="text-xs text-slate-600">Real-time chat with pre-qualified candidates</p>
                    </div>
                  </li>
                  <li className="flex gap-3 animate-fadeInUp animation-delay-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">70% Faster Hiring</p>
                      <p className="text-xs text-slate-600">Skip screening, start quality conversations</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Why Different - Built for Both */}
        <section id="why-us" className="py-10 bg-gradient-to-b from-slate-100 to-white border-y border-slate-200 animate-fadeInUp">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="mb-10">
              <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase animate-slideInLeft">
                Bidirectional Platform
              </h2>
              <p className="text-sm text-slate-600 font-semibold mt-2 max-w-3xl animate-slideInLeft animation-delay-1">
                Both sides get powerful AI. No recruiter-centric features that ignore candidates. No sacrifices.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-lg bg-white border border-slate-200 hover:shadow-md transition-all animate-fadeInUp hover:scale-105">
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 text-xs font-black">↔</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Conversational AI</h3>
                    <p className="text-xs text-slate-600 mt-1">Candidates chat about careers. Recruiters discover through conversations.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-lg bg-white border border-slate-200 hover:shadow-md transition-all animate-fadeInUp animation-delay-1 hover:scale-105">
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 text-xs font-black">↔</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Direct Chat</h3>
                    <p className="text-xs text-slate-600 mt-1">Real-time messaging. Candidates ask. Recruiters clarify. No email gaps.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-lg bg-white border border-slate-200 hover:shadow-md transition-all animate-fadeInUp animation-delay-2 hover:scale-105">
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0 text-xs font-black">↔</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Integrated Interviews</h3>
                    <p className="text-xs text-slate-600 mt-1">Candidates propose. Recruiters confirm. Auto-generated links.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-lg bg-white border border-slate-200 hover:shadow-md transition-all animate-fadeInUp animation-delay-3 hover:scale-105">
                <div className="flex items-start gap-3">
                  <span className="h-2 w-2 rounded-full bg-orange-600 mt-2 flex-shrink-0"></span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Verified Network</h3>
                    <p className="text-xs text-slate-600 mt-1">Both verified. No spam recruiters. No fake job posts.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-lg bg-white border border-slate-200 hover:shadow-md transition-all animate-fadeInUp animation-delay-1 hover:scale-105">
                <div className="flex items-start gap-3">
                  <span className="h-2 w-2 rounded-full bg-rose-600 mt-2 flex-shrink-0"></span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Smart Matching</h3>
                    <p className="text-xs text-slate-600 mt-1">Candidates see fits. Recruiters see matches. AI serves both.</p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-lg bg-white border border-slate-200 hover:shadow-md transition-all animate-fadeInUp animation-delay-2 hover:scale-105">
                <div className="flex items-start gap-3">
                  <span className="h-2 w-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0"></span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Transparent Data</h3>
                    <p className="text-xs text-slate-600 mt-1">Both see match scores. Both understand why. No hidden mechanics.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust + CTA Combined - Compact */}
        <section className="py-10 animate-fadeInUp">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 rounded-2xl p-8 text-slate-900 relative overflow-hidden shadow-lg border border-slate-200">
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-snug mb-3 animate-slideInLeft">
                  The Platform Built on <span className="text-blue-600">Trust</span>
                </h2>
                <p className="text-sm text-slate-600 font-semibold max-w-2xl mb-6 leading-relaxed animate-slideInLeft animation-delay-1">
                  Every candidate verified. Every recruiter validated. Every conversation recorded. Transparent matching. This is how modern hiring should work.
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 pb-6 border-b border-slate-300 animate-fadeInUp animation-delay-2">
                  <div>
                    <p className="text-2xl font-black text-slate-900">100%</p>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Identity Verified</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900">5x</p>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Matching Factors</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900">0.0%</p>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Spam Rate</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-900">70%</p>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1\">Faster Hiring</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 animate-fadeInUp animation-delay-3">
                  <button
                    onClick={() => setShowRegisterModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:shadow-2xl hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 group hover:scale-105"
                  >
                    Get Started
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  <Link
                    href="/login"
                    className="px-6 py-3 bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-lg border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-center hover:scale-105"
                  >
                    Sign In
                  </Link>
                </div>
              </div>

              <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
                <svg className="w-72 h-72" viewBox="0 0 100 100" fill="none">
                  <path d="M50 0L60 40L100 50L60 60L50 100L40 60L0 50L40 40L50 0Z" fill="white" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Footer - Modern & Rich */}
        <footer className="py-12 border-t border-slate-100 bg-white animate-fadeInUp">
          <div className="mx-auto max-w-7xl px-6 lg:px-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
                    <span className="text-white font-black text-sm">T</span>
                  </div>
                  <span className="text-sm font-black tracking-tight uppercase">TechSales Axis</span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  AI-powered conversational hiring platform for verified talent and real connections.
                </p>
              </div>

              {/* For Candidates */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-900"></span>
                  For Candidates
                </h4>
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Smart job recommendations
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Direct recruiter conversations
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Integrated interviews
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Career intelligence
                  </p>
                </div>
              </div>

              {/* For Recruiters */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-900"></span>
                  For Recruiters
                </h4>
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Talent pool visualization
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> AI-powered discovery
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> One-platform hiring
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Hiring analytics
                  </p>
                </div>
              </div>

              {/* Legal & Trust */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-900"></span>
                  Trust & Legal
                </h4>
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Trust policy
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Privacy policy
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Terms of service
                  </p>
                  <p className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer transition-colors font-medium flex items-center gap-2">
                    <span className="text-slate-400 font-black">•</span> Contact support
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                © 2026, TechSalesAxis.com The Next Big Idea Technologies Pvt. Ltd . All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Made for verified talent</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}