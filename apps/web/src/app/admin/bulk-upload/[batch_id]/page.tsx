/**
 * Batch Detail Page
 * Shows status, parsed files, and duplicate matches for a specific batch
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface ParsedFile {
  id: string;
  file_name: string;
  status: 'uploaded' | 'scanning' | 'parsed' | 'error';
  parsed_data: {
    name: string;
    email: string;
    phone: string;
    location: string;
    current_role: string;
    years_experience: number;
    skills: string[];
  } | null;
  error_message: string | null;
}

interface BatchDetail {
  id: string;
  batch_name: string;
  status: 'created' | 'uploading' | 'processing' | 'completed' | 'failed';
  total_files: number;
  files_processed: number;
  duplicates_found: number;
  duplicates_approved: number;
  duplicates_rejected: number;
  new_candidates_created: number;
  created_at: string;
  completed_at: string | null;
  files: ParsedFile[];
}

export default function BatchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const batchId = params?.batch_id as string;
  
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);

  useEffect(() => {
    if (batchId) {
      fetchBatchDetail();
      // Poll for updates every 5 seconds
      const interval = setInterval(fetchBatchDetail, 5000);
      return () => clearInterval(interval);
    }
  }, [batchId]);

  const fetchBatchDetail = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/admin/bulk-uploads/${batchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch batch details');
      }

      const data = await response.json();
      setBatch(data.batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'uploading':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getFileStatusIcon = (status: string) => {
    switch (status) {
      case 'parsed':
        return '✓';
      case 'scanning':
        return '⏳';
      case 'error':
        return '✕';
      default:
        return '◦';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          </div>
          <p className="text-gray-600">Loading batch details...</p>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Batch Not Found</h2>
          <p className="text-gray-600 mb-6">The batch you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/admin/bulk-upload')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg"
          >
            Back to Bulk Upload
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.round((batch.files_processed / batch.total_files) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/bulk-upload')}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            ← Back to Batches
          </button>
          <h1 className="text-4xl font-bold text-gray-800">{batch.batch_name}</h1>
          <p className="text-gray-600 mt-2">Created: {new Date(batch.created_at).toLocaleString()}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Status Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Batch Status</h2>
                <p className="text-purple-100">Overall processing status and metrics</p>
              </div>
              <span className={`px-4 py-2 rounded-full font-bold border-2 ${getStatusColor(batch.status)}`}>
                {batch.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="p-6">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700 font-medium">Processing Progress</span>
                <span className="text-gray-600 text-sm">{batch.files_processed} / {batch.total_files} files</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-purple-600 to-purple-700 h-3 rounded-full transition-all"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="text-gray-600 text-sm mt-2">{progressPercentage}% Complete</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-gray-600 text-xs font-medium">FILES PROCESSED</p>
                <p className="text-3xl font-bold text-blue-600">{batch.files_processed}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-gray-600 text-xs font-medium">DUPLICATES FOUND</p>
                <p className="text-3xl font-bold text-orange-600">{batch.duplicates_found}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-gray-600 text-xs font-medium">APPROVED MERGES</p>
                <p className="text-3xl font-bold text-green-600">{batch.duplicates_approved}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-gray-600 text-xs font-medium">NEW CANDIDATES</p>
                <p className="text-3xl font-bold text-purple-600">{batch.new_candidates_created}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Parsed Files Section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <h2 className="text-xl font-bold">Parsed Files ({batch.files.length})</h2>
            <p className="text-blue-100">Individual file processing status and extracted data</p>
          </div>

          <div className="divide-y max-h-96 overflow-y-auto">
            {batch.files.map((file) => (
              <div key={file.id} className="p-4 hover:bg-gray-50 transition">
                <button
                  onClick={() => setExpandedFileId(expandedFileId === file.id ? null : file.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-lg">{getFileStatusIcon(file.status)}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{file.file_name}</p>
                        <p className="text-gray-600 text-xs">{file.status}</p>
                      </div>
                    </div>
                    <span className="text-gray-400">▼</span>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedFileId === file.id && (
                  <div className="mt-4 pl-12 pr-4 pb-4 border-t pt-4 bg-gray-50 rounded">
                    {file.error_message ? (
                      <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded">
                        <p className="font-semibold">Error:</p>
                        <p className="text-sm">{file.error_message}</p>
                      </div>
                    ) : file.parsed_data ? (
                      <div className="space-y-3">
                        <div>
                          <p className="text-gray-600 text-xs font-medium">NAME</p>
                          <p className="text-gray-800">{file.parsed_data.name}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs font-medium">EMAIL</p>
                          <p className="text-gray-800 font-mono">{file.parsed_data.email}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs font-medium">PHONE</p>
                          <p className="text-gray-800">{file.parsed_data.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs font-medium">LOCATION</p>
                          <p className="text-gray-800">{file.parsed_data.location}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs font-medium">CURRENT ROLE</p>
                          <p className="text-gray-800">{file.parsed_data.current_role}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs font-medium">EXPERIENCE</p>
                          <p className="text-gray-800">{file.parsed_data.years_experience} years</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs font-medium mb-2">SKILLS</p>
                          <div className="flex flex-wrap gap-2">
                            {file.parsed_data.skills.map((skill, i) => (
                              <span key={i} className="bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500">Processing...</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => router.push('/admin/bulk-upload/review')}
            className="flex-1 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            Review Duplicates ({batch.duplicates_found - batch.duplicates_approved - batch.duplicates_rejected})
          </button>
          <button
            onClick={() => router.push('/admin/bulk-upload')}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            Return to Batches
          </button>
        </div>
      </div>
    </div>
  );
}
