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
  upload_status: 'created' | 'uploading' | 'processing' | 'completed' | 'failed';
  total_files_uploaded: number;
  successfully_parsed: number;
  duplicate_candidates_detected: number;
  new_candidates_identified: number;
  created_at: string;
  processing_completed_at: string | null;
}

export default function BatchesListPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'processing' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchBatches();
    // Poll for updates every 15 seconds (reduced frequency from 5s)
    const interval = setInterval(fetchBatches, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchBatches = async () => {
    try {
      // Use efficient data fetching with skip/limit
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      if (!token) {
        router.push('/login');
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
      // Backend supports skip/limit - using them here for efficiency
      const response = await fetch(`${apiUrl}/api/v1/admin/bulk-uploads?skip=0&limit=50`, {
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

  const handleDeleteBatch = async (batchId: string, batchName: string) => {
    console.log(`[DELETE] Called with batchId=${batchId}, showDeleteConfirm=${showDeleteConfirm}`);
    
    // First click: show confirmation
    if (showDeleteConfirm !== batchId) {
      console.log(`[DELETE] First click - showing confirmation`);
      setShowDeleteConfirm(batchId);
      return;
    }

    // Second click: execute delete
    console.log(`[DELETE] Second click - executing delete`);
    
    try {
      setDeletingId(batchId);
      console.log(`[DELETE] Set deletingId=${batchId}`);
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      console.log(`[DELETE] Token exists: ${!!token}`);
      
      if (!token) {
        console.log(`[DELETE] No token - redirecting to login`);
        router.push('/login');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
      const deleteUrl = `${apiUrl}/api/v1/admin/bulk-uploads/${batchId}`;
      console.log(`[DELETE] Calling DELETE endpoint: ${deleteUrl}`);
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`[DELETE] Response status: ${response.status}`);
      const responseText = await response.text();
      console.log(`[DELETE] Response body: ${responseText}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${responseText}`);
      }

      // Remove from local state
      console.log(`[DELETE] Removing batch from state`);
      setBatches(batches.filter(b => b.id !== batchId));
      setShowDeleteConfirm(null);
      setDeletingId(null);
      
      // Show toast or notification
      console.log(`[DELETE] Showing success toast`);
      const event = new CustomEvent('showToast', { 
        detail: { message: `Batch "${batchName}" deleted successfully`, type: 'success' } 
      });
      window.dispatchEvent(event);
      
      console.log(`[DELETE] Delete completed successfully`);
    } catch (err) {
      console.error(`[DELETE] Error occurred:`, err);
      const message = err instanceof Error ? err.message : 'Failed to delete batch';
      const event = new CustomEvent('showToast', { 
        detail: { message, type: 'error' } 
      });
      window.dispatchEvent(event);
      setShowDeleteConfirm(null);  // Reset confirmation state on error
    } finally {
      setDeletingId(null);
      console.log(`[DELETE] Cleanup complete`);
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
    filteredBatches = filteredBatches.filter(b => b.upload_status === filter);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-6">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium text-lg">Loading batches...</p>
          <p className="text-slate-400 text-sm mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.push('/admin/dashboard')}
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-8 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
      >
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">Data Batches</h1>
          <p className="text-slate-600">Manage and monitor all incoming candidate batches</p>
        </div>
        <button
          onClick={() => router.push('/admin/bulk-upload')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2"
        >
          ✚ New Upload
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-red-600 font-bold text-lg">⚠</span>
          <div>
            <p className="text-red-900 font-semibold">Error</p>
            <p className="text-red-800 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Search Batches</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter batch name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 pl-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 placeholder:text-slate-400 font-medium outline-none transition-all"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Filter by Status</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 font-medium outline-none transition-all bg-white"
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
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Total Batches</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{batches.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Processing</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{batches.filter(b => b.upload_status === 'processing').length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Completed</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{batches.filter(b => b.upload_status === 'completed').length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Total Resumes</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{batches.reduce((sum, b) => sum + (b.total_files_uploaded || 0), 0)}</p>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredBatches.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-5xl mb-4">📭</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No batches found</h3>
            <p className="text-slate-600 mb-6">
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your filters or start a new upload'
                : 'Start by uploading a new batch of resumes'}
            </p>
            <button
              onClick={() => router.push('/admin/bulk-upload')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-8 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              Create New Batch
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 text-xs uppercase tracking-wider">Batch Name</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 text-xs uppercase tracking-wider">Progress</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 text-xs uppercase tracking-wider">Matches</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 text-xs uppercase tracking-wider">New Records</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 text-xs uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-left font-bold text-slate-700 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{batch.batch_name}</p>
                        <p className="text-slate-600 text-xs mt-1">{batch.id.substring(0, 8)}...</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                        batch.upload_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        batch.upload_status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        batch.upload_status === 'uploading' ? 'bg-amber-100 text-amber-700' :
                        batch.upload_status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        <span>{
                          batch.upload_status === 'completed' ? '✓' :
                          batch.upload_status === 'processing' ? '⏳' :
                          batch.upload_status === 'uploading' ? '📤' :
                          batch.upload_status === 'failed' ? '✕' :
                          '◦'
                        }</span>
                        {batch.upload_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {Math.min(batch.successfully_parsed, batch.total_files_uploaded)} / {batch.total_files_uploaded}
                        </p>
                        <div className="w-32 bg-slate-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${batch.total_files_uploaded > 0 ? Math.min(100, Math.round((batch.successfully_parsed / batch.total_files_uploaded) * 100)) : 0}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full font-bold text-xs ${
                        batch.duplicate_candidates_detected > 0
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {batch.duplicate_candidates_detected}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full font-bold text-xs bg-emerald-100 text-emerald-700">
                        {batch.new_candidates_identified}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div>
                        {new Date(batch.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs text-slate-500">{new Date(batch.created_at).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button
                          onClick={() => router.push(`/admin/bulk-upload/${batch.id}`)}
                          className="text-blue-600 hover:text-blue-700 font-semibold text-sm hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Details
                        </button>
                        {batch.duplicate_candidates_detected > 0 && (
                          <button
                            onClick={() => router.push('/admin/bulk-upload/review')}
                            className="text-amber-600 hover:text-amber-700 font-semibold text-sm hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-all"
                          >
                            Review
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteBatch(batch.id, batch.batch_name)}
                          disabled={deletingId === batch.id}
                          className={`font-semibold text-sm px-3 py-1.5 rounded-lg transition-all ${
                            showDeleteConfirm === batch.id
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                          } ${deletingId === batch.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {showDeleteConfirm === batch.id ? 'Confirm Delete?' : 'Delete'}
                        </button>
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
      <div className="mt-6 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-900 text-sm font-medium">
          ℹ️ <strong>Auto-refresh:</strong> This page updates automatically to show the latest status every 15 seconds
        </p>
      </div>
    </div>
  );
}
