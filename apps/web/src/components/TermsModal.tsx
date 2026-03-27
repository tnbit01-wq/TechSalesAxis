"use client";

import { X } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-bold text-slate-900">Terms & Conditions</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-600">
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">1. High-Trust Verification</h3>
            <p className="text-sm leading-relaxed">
              TechSales Axis is built on the principle of verified excellence. By using this platform, you agree to provide accurate, current, and complete information. Users found uploading falsified government identification or providing fraudulent professional history will have their accounts permanently deactivated.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">2. Assessment Integrity</h3>
            <p className="text-sm leading-relaxed">
              The proprietary assessment suite is a measure of your individual capability. You agree to complete all assessments personally without the use of external aids, AI tools (other than those provided by the platform), or third-party assistance. Profile &quot;Locking&quot; occurs after the assessment to ensure the integrity of the data presented to recruiters.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">3. Application Limits & Anti-Spam</h3>
            <p className="text-sm leading-relaxed">
              To maintain high quality for both candidates and recruiters, TechSales Axis enforces a maximum of 5 job applications per 24-hour period. This encourages thoughtful, targeted applications. Mass-applying or automated application scripts are strictly prohibited.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">4. Data Privacy & Documentation</h3>
            <p className="text-sm leading-relaxed">
              Your uploaded documents (ID proofs, resumes) are stored in secure, encrypted buckets. We do not sell your personal identifying data to third parties. Recruiters only see your verification status, assessment scores, and resume once you apply for a position.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">5. Professional Conduct</h3>
            <p className="text-sm leading-relaxed">
              Communication through the TechSales Axis Controlled Chat must remain professional. Harassment, solicitation, or sharing of external contact information to bypass platform security during the early interview stages is discouraged and may result in a trust-score penalty.
            </p>
          </section>

          <section className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 italic">
              Last Updated: February 2025. TechSales Axis reserves the right to update these terms to maintain platform security.
            </p>
          </section>
        </div>

        <div className="p-4 bg-slate-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
