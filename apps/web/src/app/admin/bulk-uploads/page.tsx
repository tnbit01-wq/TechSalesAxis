/**
 * Admin Batches List Page
 * Shows all uploaded bulk upload batches with filters and search
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BatchSummary {
  id: string;
  batch_name: string;
  status: 'created' | 'uploading' | 'processing' | 'completed' | 'failed';
  total_files: number;
  files_processed: number;
  duplicates_found: number;
  new_candidates_created: number;
  created_at: string;
  completed_at: string | null;
}

export default function BatchesListPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'processing' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBatches();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchBatches, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchBatches = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/admin/bulk-uploads', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch batches');
      }

      const data = await response.json();
      setBatches(data.batches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'uploading':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'processing':
        return '⏳';
      case 'uploading':
        return '📤';
      case 'failed':
        return '✕';
      default:
        return '◦';
    }
  };

  let filteredBatches = batches;

  // Apply status filter
  if (filter !== 'all') {
    filteredBatches = filteredBatches.filter(b => b.status === filter);
  }

  // Apply search filter
  if (searchQuery) {
    filteredBatches = filteredBatches.filter(b =>
      b.batch_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Sort by created date (newest first)
  filteredBatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          </div>
          <p className="text-gray-600">Loading batches...</p>
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
            onClick={() => router.push('/admin/dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-800">Upload Batches</h1>
              <p className="text-gray-600 mt-2">Manage and monitor all bulk resume uploads</p>
            </div>
            <button
              onClick={() => router.push('/admin/bulk-upload')}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 px-6 rounded-lg transition shadow-lg"
            >
              + New Upload
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search batches
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter batch name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 pl-10"
                />
                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by status
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="all">All Statuses</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-xs font-medium">TOTAL BATCHES</p>
            <p className="text-3xl font-bold text-blue-600">{batches.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-xs font-medium">PROCESSING</p>
            <p className="text-3xl font-bold text-yellow-600">{batches.filter(b => b.status === 'processing').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-xs font-medium">COMPLETED</p>
            <p className="text-3xl font-bold text-green-600">{batches.filter(b => b.status === 'completed').length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-600 text-xs font-medium">TOTAL RESUMES</p>
            <p className="text-3xl font-bold text-purple-600">{batches.reduce((sum, b) => sum + b.files_processed, 0)}</p>
          </div>
        </div>

        {/* Batches Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredBatches.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">📭</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No batches found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || filter !== 'all'
                  ? 'Try adjusting your filters or start a new upload'
                  : 'Start by uploading a new batch of resumes'}
              </p>
              <button
                onClick={() => router.push('/admin/bulk-upload')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                Create New Batch
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold">BATCH NAME</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold">PROGRESS</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold">DUPLICATES</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold">NEW RECORDS</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold">CREATED</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-800">{batch.batch_name}</p>
                          <p className="text-gray-600 text-xs">{batch.id.substring(0, 8)}...</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(batch.status)}`}>
                          <span>{getStatusIcon(batch.status)}</span>
                          {batch.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {batch.files_processed} / {batch.total_files} files
                          </p>
                          <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${Math.round((batch.files_processed / batch.total_files) * 100)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded font-semibold text-xs ${
                          batch.duplicates_found > 0
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {batch.duplicates_found}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded font-semibold text-xs bg-green-100 text-green-800">
                          {batch.new_candidates_created}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(batch.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">{new Date(batch.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/admin/bulk-upload/${batch.id}`)}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            Details
                          </button>
                          {batch.duplicates_found > 0 && (
                            <button
                              onClick={() => router.push('/admin/bulk-upload/review')}
                              className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                            >
                              Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-900 text-sm">
            📊 <strong>Auto-refresh:</strong> This page updates every 5 seconds to show the latest batch status
          </p>
        </div>
      </div>
    </div>
  );
}
