"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import CandidateProfileModal from "@/components/CandidateProfileModal";
import { apiClient } from "@/lib/apiClient";
import { awsAuth } from "@/lib/awsAuth";

type CandidateResponse = {
  user_id: string;
  full_name: string;
  bio?: string;
  current_role?: string;
  years_of_experience?: number;
  location?: string;
  phone_number?: string;
  gender?: string;
  birthdate?: string;
  profile_photo_url?: string;
  resume_path?: string | null;
  skills?: string[];
  resume_data?: Record<string, unknown> | null;
  profile_scores?: {
    final_score?: number;
  };
};

const ALLOWED_TABS = new Set(["application", "interview", "resume", "original_resume"]);

export default function RecruiterCandidateProfilePage() {
  const params = useParams<{ candidateId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const candidateId = params?.candidateId;
  const [candidate, setCandidate] = useState<CandidateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialTab = useMemo(() => {
    const tab = searchParams.get("tab") || "resume";
    return ALLOWED_TABS.has(tab) ? tab : "resume";
  }, [searchParams]);

  useEffect(() => {
    async function loadCandidate() {
      if (!candidateId) return;

      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const data = await apiClient.get(`/recruiter/candidate/${candidateId}`, token);
        setCandidate(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load candidate profile");
      } finally {
        setLoading(false);
      }
    }

    loadCandidate();
  }, [candidateId, router]);

  const handleClose = () => {
    router.push("/dashboard/recruiter/talent-pool");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-slate-700 font-medium">{error || "Candidate not found"}</p>
        <button
          onClick={handleClose}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Back to Talent Pool
        </button>
      </div>
    );
  }

  const candidateForModal = {
    ...candidate,
    skills: candidate.skills || [],
  };

  return (
    <CandidateProfileModal
      isOpen={true}
      onClose={handleClose}
      candidate={candidateForModal}
      resumeData={candidate.resume_data || undefined}
      jobTitle="AI Assistant Candidate View"
      appliedDate={new Date().toISOString()}
      score={candidate.profile_scores?.final_score || 0}
      initialTab={initialTab}
      isDiscovery={true}
    />
  );
}
