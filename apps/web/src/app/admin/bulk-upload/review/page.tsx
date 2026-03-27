/**
 * Duplicate Review Page
 * Admin interface to review and resolve duplicate matches
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DuplicateMatch {
  id: string;
  file_id: string;
  file_name: string;
  uploaded_candidate_name: string;
  uploaded_email: string;
  uploaded_phone: string;
  uploaded_skills: string[];
  
  matched_candidate_id: string;
  matched_candidate_name: string;
  matched_email: string;
  matched_phone: string;
  matched_skills: string[];
  
  match_confidence: number;
  match_reason: string;
  admin_decision: 'pending' | 'approved' | 'rejected' | 'skipped';
  admin_notes: string;
}

export default function DuplicateReviewPage() {
  const router = useRouter();
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicateMatch | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const fetchDuplicates = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/admin/duplicates/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch duplicates');
      }

      const data = await response.json();
      setDuplicates(data.duplicates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (matchId: string, decision: 'approved' | 'rejected' | 'skipped', notes?: string) => {
    setProcessingId(matchId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/admin/duplicates/${matchId}/review`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision,
          admin_notes: notes,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save decision');
      }

      // Remove resolved duplicate from list
      setDuplicates(duplicates.filter(d => d.id !== matchId));
      setSelectedDuplicate(null);

      // Show success message
      alert(`Duplicate ${decision}! Profile will be ${decision === 'approved' ? 'merged' : 'kept separate'}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          </div>
          <p className="text-gray-600">Loading duplicates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-gray-800">Review Duplicate Matches</h1>
          <p className="text-gray-600 mt-2">
            {duplicates.length} pending matches found. Review and approve merges.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {duplicates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Pending Matches</h2>
            <p className="text-gray-600">All duplicate matches have been reviewed!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Duplicates List */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-4">
                <h2 className="font-bold text-lg">Pending Matches ({duplicates.length})</h2>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {duplicates.map((duplicate) => (
                  <button
                    key={duplicate.id}
                    onClick={() => setSelectedDuplicate(duplicate)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                      selectedDuplicate?.id === duplicate.id ? 'bg-orange-50 border-l-4 border-orange-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                          {duplicate.uploaded_candidate_name}
                        </p>
                        <p className="text-gray-600 text-xs truncate">{duplicate.uploaded_email}</p>
                      </div>
                      <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-semibold">
                        {Math.round(duplicate.match_confidence * 100)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail View */}
            {selectedDuplicate ? (
              <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Match Details</h2>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-2xl font-bold text-orange-600">
                        {Math.round(selectedDuplicate.match_confidence * 100)}%
                      </span>
                      <p className="text-gray-600 text-sm">Match Confidence</p>
                    </div>
                    <div>
                      <p className="text-gray-700">{selectedDuplicate.match_reason}</p>
                    </div>
                  </div>
                </div>

                {/* Comparison Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Left: Uploaded Resume */}
                  <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h3 className="font-bold text-blue-900 mb-3">Uploaded Resume</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-gray-600 text-xs font-medium">NAME</p>
                        <p className="font-semibold text-gray-800">{selectedDuplicate.uploaded_candidate_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs font-medium">EMAIL</p>
                        <p className="font-mono text-gray-800">{selectedDuplicate.uploaded_email}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs font-medium">PHONE</p>
                        <p className="font-mono text-gray-800">{selectedDuplicate.uploaded_phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs font-medium">SKILLS</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedDuplicate.uploaded_skills.map((skill, i) => (
                            <span key={i} className="bg-blue-200 text-blue-900 px-2 py-1 rounded text-xs">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Existing Profile */}
                  <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                    <h3 className="font-bold text-green-900 mb-3">Existing Profile</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-gray-600 text-xs font-medium">NAME</p>
                        <p className="font-semibold text-gray-800">{selectedDuplicate.matched_candidate_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs font-medium">EMAIL</p>
                        <p className="font-mono text-gray-800">{selectedDuplicate.matched_email}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs font-medium">PHONE</p>
                        <p className="font-mono text-gray-800">{selectedDuplicate.matched_phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-xs font-medium">SKILLS</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedDuplicate.matched_skills.map((skill, i) => (
                            <span key={i} className="bg-green-200 text-green-900 px-2 py-1 rounded text-xs">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="border-t pt-6">
                  <p className="text-gray-600 text-sm mb-4">What would you like to do?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDecision(selectedDuplicate.id, 'approved')}
                      disabled={processingId === selectedDuplicate.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                      {processingId === selectedDuplicate.id ? '⏳ Merging...' : '✓ Merge Profiles'}
                    </button>
                    <button
                      onClick={() => handleDecision(selectedDuplicate.id, 'rejected')}
                      disabled={processingId === selectedDuplicate.id}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                      {processingId === selectedDuplicate.id ? '⏳ Processing...' : '✗ Keep Separate'}
                    </button>
                    <button
                      onClick={() => handleDecision(selectedDuplicate.id, 'skipped')}
                      disabled={processingId === selectedDuplicate.id}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition"
                    >
                      {processingId === selectedDuplicate.id ? '⏳ Skipping...' : '➜ Skip for Now'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500 text-lg">Select a match from the list to review</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
