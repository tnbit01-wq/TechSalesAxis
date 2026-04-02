"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  Building2,
  Calendar,
  ChevronRight,
  TrendingUp,
  Users,
  Activity,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

interface ProfileView {
  id: string;
  recruiter_id: string;
  recruiter_name: string;
  company_name: string;
  viewed_at: string;
}

interface ProfileStats {
  total_views: number;
  unique_recruiters: number;
  views_by_day: Array<{
    date: string;
    count: number;
  }>;
}

export default function ProfileAnalyticsPage() {
  const router = useRouter();
  const [profileViews, setProfileViews] = useState<ProfileView[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [isShadowProfile, setIsShadowProfile] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const candidateId = profile?.user_id;
        if (!candidateId) {
          const profileData = await apiClient.get("/candidate/profile", token);
          setProfile(profileData);
          return;
        }

        const [viewsData, statsData] = await Promise.all([
          apiClient.get("/analytics/candidate/profile-views", token),
          apiClient.get(`/analytics/profile/${candidateId}/stats`, token),
        ]);

        setProfileViews(viewsData.profile_views || []);
        setStats(statsData);
        
        // Check if shadow profile
        if (statsData.is_shadow_profile) {
          setIsShadowProfile(true);
        }
      } catch (err) {
        console.error("Failed to load profile analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    if (profile?.user_id) {
      loadData();
    }
  }, [profile?.user_id, router]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = awsAuth.getToken();
        if (!token) return;

        const profileData = await apiClient.get("/candidate/profile", token);
        setProfile(profileData);
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Profile Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 pb-20">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Profile Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">See who has viewed your profile and track your visibility with recruiters.</p>
      </header>

      {/* Shadow Profile Warning */}
      {isShadowProfile && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-10a9 9 0 110 18 9 9 0 010-18z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900">Shadow Profile</h3>
              <p className="text-sm text-amber-800 mt-1">
                Your profile was created through bulk upload and is pending activation. Complete your profile registration to start receiving recruiter notifications and profile analytics.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <Eye className="h-5 w-5 text-blue-600" />
            <TrendingUp className="h-5 w-5 text-slate-200" />
          </div>
          <p className="text-slate-500 text-sm font-semibold uppercase tracking-widest">Total Profile Views</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.total_views || 0}</p>
          <p className="text-slate-400 text-xs mt-2">
            {stats && stats.views_by_day.length > 0
              ? `${stats.views_by_day[0].count} views today`
              : "No views yet"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <Users className="h-5 w-5 text-green-600" />
            <TrendingUp className="h-5 w-5 text-slate-200" />
          </div>
          <p className="text-slate-500 text-sm font-semibold uppercase tracking-widest">Unique Recruiters</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.unique_recruiters || 0}</p>
          <p className="text-slate-400 text-xs mt-2">
            {stats && stats.unique_recruiters > 0
              ? `${stats.unique_recruiters} recruiter${stats.unique_recruiters !== 1 ? 's' : ''} viewed`
              : "No views yet"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <Activity className="h-5 w-5 text-purple-600" />
            <TrendingUp className="h-5 w-5 text-slate-200" />
          </div>
          <p className="text-slate-500 text-sm font-semibold uppercase tracking-widest">Last 7 Days</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {stats && stats.views_by_day.reduce((sum, day) => sum + day.count, 0)}
          </p>
          <p className="text-slate-400 text-xs mt-2">
            {stats?.views_by_day.length || 0} days with activity
          </p>
        </div>
      </div>

      {/* Recent Views */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Eye className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900">Recent Profile Views</h2>
          <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
            {profileViews.length} view{profileViews.length !== 1 ? 's' : ''}
          </span>
        </div>

        {profileViews.length === 0 ? (
          <div className="py-12 text-center">
            <Eye className="h-10 w-10 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No Profile Views Yet</h3>
            <p className="text-slate-500 text-sm mt-1">
              Complete your profile and apply to jobs to get noticed by recruiters
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {profileViews.map((view) => (
              <div
                key={view.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {view.recruiter_name}
                    <span className="text-slate-400 font-normal"> from </span>
                    <span className="text-blue-600">{view.company_name}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    <p className="text-xs text-slate-500">
                      {new Date(view.viewed_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Views by Day */}
      {stats && stats.views_by_day.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Views Activity (Last 7 Days)
          </h2>
          <div className="space-y-3">
            {stats.views_by_day.map((day, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-24">
                  <p className="text-sm font-medium text-slate-600">
                    {new Date(day.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300"
                      style={{
                        width: `${(day.count / Math.max(...stats.views_by_day.map(d => d.count))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="w-12 text-right">
                  <p className="text-sm font-bold text-slate-900">{day.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pro Tips */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-6 rounded-3xl">
        <h3 className="font-bold text-slate-900 mb-3">💡 Tips to Increase Profile Views</h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>✓ Complete all sections of your profile (skills, experience, education)</li>
          <li>✓ Upload a professional profile photo</li>
          <li>✓ Write a compelling bio and career goals</li>
          <li>✓ Apply to jobs that match your skills</li>
          <li>✓ Keep your profile updated with recent achievements</li>
        </ul>
      </div>
    </div>
  );
}
