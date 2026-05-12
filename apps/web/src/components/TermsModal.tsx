"use client";

import { X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void | Promise<void>;
}

export function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [hasScrolledToBottomEver, setHasScrolledToBottomEver] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setHasScrolledToBottom(false);
      setHasScrolledToBottomEver(false);
      setScrollPercentage(0);
    }
  }, [isOpen]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    
    // Calculate scroll percentage
    const totalScroll = scrollHeight - clientHeight;
    const currentScroll = scrollTop;
    const percentage = totalScroll > 0 ? (currentScroll / totalScroll) * 100 : 0;
    setScrollPercentage(percentage);
    
    // Require scrolling to at least 95% to consider as "read"
    const isAtBottom = percentage >= 95;
    setHasScrolledToBottom(isAtBottom);
    
    // Once scrolled to bottom, keep it enabled (lock the state)
    if (isAtBottom) {
      setHasScrolledToBottomEver(true);
    }
  };

  const handleCloseClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Close button only works after scrolling to bottom
    if (hasScrolledToBottomEver) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  const handleAcceptClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      if (!hasScrolledToBottomEver) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      // Close modal immediately (don't wait for async operations)
      onClose();
      
      // Call onAccept callback in background (non-blocking)
      if (onAccept) {
        try {
          await onAccept();
        } catch (error) {
          console.error("Error in onAccept callback:", error);
        }
      }
    } catch (error) {
      console.error("Error in handleAcceptClick:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Prevent Escape key from closing modal unless scrolled to bottom completely
    if (e.key === "Escape" && !hasScrolledToBottomEver) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onKeyDown={handleKeyDown}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-[#ff9800] to-[#ff6f00] px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-white">Terms & Conditions</h2>
            <p className="text-xs text-orange-100 mt-1">Effective: May 4, 2026</p>
          </div>
          <button
            onClick={handleCloseClick}
            onKeyDown={(e) => {
              if (!hasScrolledToBottomEver && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            disabled={!hasScrolledToBottomEver}
            tabIndex={hasScrolledToBottomEver ? 0 : -1}
            className={`p-2 rounded-full transition-colors ${
              hasScrolledToBottomEver 
                ? "hover:bg-orange-500 text-white/80 hover:text-white cursor-pointer" 
                : "text-white/50 cursor-not-allowed opacity-60 pointer-events-none"
            }`}
            type="button"
            aria-label="Close terms modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-600">
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

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">6. Assessment Requirements & Validity</h3>
            <p className="text-sm leading-relaxed">
              To apply for positions on TechSales Axis, you must complete the skills assessment. Assessment scores are valid for 12 months from completion. If your score expires, you will need to retake the assessment. Assessment results are used to match you with appropriate job opportunities and to provide recruiters with verified skill validation.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">7. Account Eligibility & Compliance</h3>
            <p className="text-sm leading-relaxed">
              You must be at least 18 years old to use this platform. By accepting these terms, you certify that all information provided is accurate, truthful, and current. TechSales Axis reserves the right to suspend or permanently deactivate accounts that violate these terms or engage in fraudulent behavior.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">8. Dispute Resolution & Liability</h3>
            <p className="text-sm leading-relaxed">
              TechSales Axis is a platform connecting candidates with recruiters. We are not responsible for employment decisions, salary negotiations, or disputes between candidates and recruiters. All disputes must be resolved through standard employment law procedures. Use of this platform constitutes acceptance of these terms in their entirety.
            </p>
          </section>

          <section className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 italic">
              Last Updated: May 4, 2026. TechSales Axis reserves the right to update these terms to maintain platform security and improve user experience.
            </p>
          </section>
        </div>

        <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-50/50 border-t border-orange-100 flex justify-between items-center gap-3">
          <div className="flex-1">
            {hasScrolledToBottomEver && (
              <span className="text-xs font-medium text-green-600">✓ You've read all terms</span>
            )}
          </div>
          <button
            onClick={handleAcceptClick}
            onKeyDown={(e) => {
              if (!hasScrolledToBottomEver && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            disabled={!hasScrolledToBottomEver}
            tabIndex={hasScrolledToBottomEver ? 0 : -1}
            className={`px-6 py-2.5 font-semibold rounded-xl transition-all shadow-sm flex-shrink-0 ${
              hasScrolledToBottomEver
                ? "bg-gradient-to-r from-[#ff9800] to-[#ff6f00] text-white hover:from-[#ff8c00] hover:to-[#ff5c00] active:scale-95 cursor-pointer"
                : "bg-slate-200 text-slate-500 cursor-not-allowed opacity-60 pointer-events-none"
            }`}
            type="button"
          >
            {hasScrolledToBottomEver ? "✓ Accept Terms" : "Accept Terms"}
          </button>
        </div>
      </div>
    </div>
  );
}

