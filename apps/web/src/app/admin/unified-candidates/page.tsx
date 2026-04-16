'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, Download, Eye, Send, MessageSquare, AlertCircle, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  batch_id: string;
  batch_name: string;
  file_name: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  current_role: string;
  years_experience: number;
  highest_education?: string;
  skills: string[];
  status: string;
  is_shadow: boolean;
}

// Helper function to safely parse skills data
const normalizeSkills = (skills: any): string[] => {
  if (Array.isArray(skills)) {
    return skills.filter(s => typeof s === 'string').map(s => s.trim());
  }
  if (typeof skills === 'string') {
    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(skills);
      if (Array.isArray(parsed)) {
        return parsed.filter(s => typeof s === 'string').map(s => s.trim());
      }
    } catch {
      // Not JSON, might be comma-separated or single string
      if (skills.includes(',')) {
        return skills.split(',').filter(s => s.trim()).map(s => s.trim());
      }
      return skills.trim() ? [skills.trim()] : [];
    }
  }
  return [];
};

// Helper to normalize candidate data from API
const normalizeCandidateData = (candidate: any): Candidate => ({
  ...candidate,
  skills: normalizeSkills(candidate.skills),
});

export default function UnifiedCandidatesDashboard() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    role: '',
    minExp: '',
    maxExp: '',
    skills: '',
    education: '',
  });

  // Chat/Prompt state
  const [promptInput, setPromptInput] = useState('');
  const [promptResults, setPromptResults] = useState<Candidate[]>([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Candidate[]>([]);

  const fetchAllCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('tf_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/api/v1/admin/unified-candidates`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch candidates');
      }

      const data = await response.json();
      const normalizedCandidates = (data.candidates || []).map(normalizeCandidateData);
      setCandidates(normalizedCandidates);
      if (!normalizedCandidates || normalizedCandidates.length === 0) {
        setError('No candidates found. Please upload and parse resume batches first.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load candidates';
      console.error('Failed to fetch candidates:', err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAllCandidates();
  }, [fetchAllCandidates]);

  const filteredCandidates = candidates.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    const skillsList = Array.isArray(c.skills) ? c.skills : [];
    const matchesSearch = !searchTerm || 
      c.name.toLowerCase().includes(searchLower) ||
      c.email.toLowerCase().includes(searchLower) ||
      c.current_role.toLowerCase().includes(searchLower) ||
      skillsList.some(s => s.toLowerCase().includes(searchLower));

    const matchesLocation = !filters.location || 
      c.location.toLowerCase().includes(filters.location.toLowerCase());
    
    const matchesRole = !filters.role || 
      c.current_role.toLowerCase().includes(filters.role.toLowerCase());
    
    const matchesMinExp = !filters.minExp || 
      c.years_experience >= parseInt(filters.minExp);
    
    const matchesMaxExp = !filters.maxExp || 
      c.years_experience <= parseInt(filters.maxExp);

    const matchesSkills = !filters.skills ||
      filters.skills.split(',').some(skill =>
        skillsList.some(s => s.toLowerCase().includes(skill.trim().toLowerCase()))
      );

    const matchesEducation = !filters.education ||
      c.highest_education?.toLowerCase().includes(filters.education.toLowerCase());

    return matchesSearch && matchesLocation && matchesRole && matchesMinExp && 
           matchesMaxExp && matchesSkills && matchesEducation;
  });

  const handlePromptSubmit = async () => {
    if (!promptInput.trim()) {
      toast.error('Please enter your requirements');
      return;
    }

    setPromptLoading(true);
    try {
      const token = localStorage.getItem('tf_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

      const response = await fetch(`${apiUrl}/api/v1/admin/match-candidates-by-prompt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptInput,
          from_candidates: candidates,
        }),
      });

      if (!response.ok) throw new Error('Failed to process prompt');

      const data = await response.json();
      const matched = data.matched_candidates || [];
      setPromptResults(matched);
      setSelectedResults(matched.slice(0, 20)); // Show top 20
      toast.success(`Found ${matched.length} matching candidates`);
    } catch (err) {
      console.error('Prompt processing failed:', err);
      toast.error('Failed to process prompt');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleExportFiltered = () => {
    const displayCandidates = promptResults.length > 0 ? promptResults : filteredCandidates;
    const headers = ['Name', 'Email', 'Phone', 'Location', 'Current Role', 'Experience (Yrs)', 'Education', 'Skills', 'Batch', 'Status'];
    const rows = displayCandidates.map(c => [
      c.name,
      c.email,
      c.phone,
      c.location,
      c.current_role,
      c.years_experience,
      c.highest_education || '',
      c.skills.join(' | '),
      c.batch_name,
      c.status,
    ].map(cell => `"${String(cell).replace(/"/g, '""')}"`));

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `unified_candidates_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayCandidates = promptResults.length > 0 ? promptResults : filteredCandidates;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-6">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium text-lg">Loading candidates...</p>
          <p className="text-slate-400 text-sm mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-blue-600 text-white rounded-lg shadow-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Unified Candidate Pool</h1>
              <p className="text-slate-600 mt-1">All candidates from all bulk upload batches</p>
            </div>
          </div>
          {error && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-900 font-medium">Notice</p>
                <p className="text-amber-800 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Prompt Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">AI-Powered Candidate Matching</h2>
          </div>
          <p className="text-slate-600 text-sm mb-4">
            Describe your ideal candidate in plain language. Our AI will find matches across the entire pool.
          </p>
          
          <div className="flex gap-3">
            <textarea
              placeholder="Example: 'Find experienced sales managers from Mumbai or Bangalore with strong CRM and MS Office skills. They should have 5-10 years in sales'..."
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none text-sm font-medium outline-none placeholder:text-slate-400 transition-all"
              rows={3}
            />
            <button
              onClick={handlePromptSubmit}
              disabled={promptLoading || !promptInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 whitespace-nowrap transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Send className="w-4 h-4" />
              {promptLoading ? 'Searching...' : 'Match'}
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5 text-slate-600" />
            Advanced Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Search location..."
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium outline-none placeholder:text-slate-400 transition-all"
            />
            <input
              type="text"
              placeholder="Search role..."
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium outline-none placeholder:text-slate-400 transition-all"
            />
            <input
              type="text"
              placeholder="Search education..."
              value={filters.education}
              onChange={(e) => setFilters({ ...filters, education: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium outline-none placeholder:text-slate-400 transition-all"
            />
            <input
              type="number"
              placeholder="Min experience (years)"
              value={filters.minExp}
              onChange={(e) => setFilters({ ...filters, minExp: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium outline-none placeholder:text-slate-400 transition-all"
            />
            <input
              type="number"
              placeholder="Max experience (years)"
              value={filters.maxExp}
              onChange={(e) => setFilters({ ...filters, maxExp: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium outline-none placeholder:text-slate-400 transition-all"
            />
            <input
              type="text"
              placeholder="Search skills (comma-separated)..."
              value={filters.skills}
              onChange={(e) => setFilters({ ...filters, skills: e.target.value })}
              className="px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-medium outline-none placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Results Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">
                {candidates.length === 0 ? 'No Candidates' : promptResults.length > 0 
                  ? `AI-Matched Results (${displayCandidates.length})`
                  : `All Candidates (${displayCandidates.length})`
                }
              </h3>
              {promptResults.length > 0 && (
                <p className="text-sm text-blue-600 mt-1 font-medium">Matched for: "{promptInput}"</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPromptResults([])}
                disabled={promptResults.length === 0}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                Clear Filter
              </button>
              <button
                onClick={handleExportFiltered}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                <Download className="w-4 h-4" />
                Export ({displayCandidates.length})
              </button>
            </div>
          </div>

          {/* Results Table */}
          {candidates.length === 0 ? (
            <div className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-slate-100 rounded-full mb-4">
                <AlertCircle className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No candidates available</p>
              <p className="text-slate-400 text-sm mt-1">Upload and parse resume batches to see candidates here</p>
              <button
                onClick={() => router.push('/admin/bulk-uploads')}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-all"
              >
                Go to Upload
              </button>
            </div>
          ) : displayCandidates.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No candidates match your criteria</p>
              <button
                onClick={() => {
                  setFilters({ location: '', role: '', minExp: '', maxExp: '', skills: '', education: '' });
                  setPromptResults([]);
                }}
                className="mt-3 text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-[700px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left whitespace-nowrap min-w-[180px]">Name</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap min-w-[200px]">Email</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap min-w-[150px]">Location</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap min-w-[150px]">Role</th>
                      <th className="px-4 py-3 text-center whitespace-nowrap min-w-[100px]">Experience</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap min-w-[120px]">Education</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap min-w-[200px]">Skills</th>
                      <th className="px-4 py-3 text-left whitespace-nowrap min-w-[100px]">Batch</th>
                      <th className="px-4 py-3 text-center whitespace-nowrap min-w-[80px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayCandidates.map((candidate) => (
                      <tr key={candidate.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 truncate">{candidate.name || '-'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-xs text-slate-600 truncate" title={candidate.email}>{candidate.email || '-'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-slate-700 text-sm truncate block">{candidate.location || '-'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-slate-700 text-sm truncate block">{candidate.current_role || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{candidate.years_experience || 0} yrs</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-slate-600">{candidate.highest_education || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(candidate.skills) && candidate.skills.slice(0, 2).map((skill, i) => (
                              <span key={i} className="inline-flex items-center bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
                                {skill}
                              </span>
                            ))}
                            {Array.isArray(candidate.skills) && candidate.skills.length > 2 && (
                              <span className="text-slate-500 text-xs font-medium">+{candidate.skills.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded font-medium">{candidate.batch_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button 
                            onClick={() => router.push(`/admin/unified-candidates/${candidate.id}`)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold text-xs hover:bg-blue-50 px-2 py-1 rounded transition-all"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
