/**
 * Batch Detail Page
 * Shows status, parsed files, and duplicate matches for a specific batch
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ComprehensiveDataTable from '@/components/admin/ComprehensiveDataTable';

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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  const handleDownloadCsv = () => {
    if (!batch) return;
    const headers = ['File Name', 'Status', 'Name', 'Email', 'Phone', 'Location', 'Current Role', 'Years Experience', 'Skills', 'Error Message'];
    const rows = batch.files.map((f: any) => {
      let skillsArr: string[] = [];
      if (f.parsed_data && f.parsed_data.skills) {
        if (Array.isArray(f.parsed_data.skills)) {
          skillsArr = f.parsed_data.skills;
        } else if (typeof f.parsed_data.skills === 'object') {
          skillsArr = Object.values(f.parsed_data.skills).flat() as string[];
        }
      }
      return [
        f.file_name,
        f.status,
        f.parsed_data?.name || '',
        f.parsed_data?.email || '',
        f.parsed_data?.phone || '',
        f.parsed_data?.location || '',
        f.parsed_data?.current_role || '',
        f.parsed_data?.years_experience || '',
        skillsArr.join(' | '),
        f.error_message || ''
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`); // Escape quotes
    });
    
    const csvContent = [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `batch_${batch.batch_name.replace(/\s+/g, '_')}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      if (!token) {
        router.push('/login');
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/api/v1/admin/bulk-uploads/${batchId}`, {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-6">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium text-lg">Loading batch details...</p>
          <p className="text-slate-400 text-sm mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Batch Not Found</h2>
          <p className="text-slate-600 mb-6">The batch you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => router.push('/admin/bulk-uploads')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-8 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Back to Batches
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.round((batch.files_processed / batch.total_files) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Back Button */}
        <button
          onClick={() => router.push('/admin/bulk-uploads')}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-6 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
        >
          ← Back to Batches
        </button>

        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">{batch.batch_name}</h1>
          <p className="text-slate-600 text-sm">
            ID: {batch.id} • Created: {new Date(batch.created_at).toLocaleString()}
          </p>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <span className="text-red-600 font-bold text-lg">⚠</span>
              <div>
                <p className="text-red-900 font-semibold">Error</p>
                <p className="text-red-800 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Status Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Batch Status</h2>
                <p className="text-blue-100 text-sm mt-1">Overall processing status and metrics</p>
              </div>
              <span className={`px-4 py-2.5 rounded-full font-bold text-sm border-2 ${
                batch.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
                batch.status === 'processing' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                batch.status === 'uploading' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                batch.status === 'failed' ? 'bg-red-100 text-red-700 border-red-300' :
                'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                {batch.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="p-6">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-700 font-semibold">Processing Progress</span>
                <span className="text-slate-600 text-sm font-medium">{batch.files_processed} / {batch.total_files} files</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-blue-700 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <p className="text-slate-600 text-sm font-medium mt-2">{progressPercentage}% Complete</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 hover:shadow-md transition-all">
                <p className="text-blue-600 text-xs font-bold uppercase tracking-wider">Files Processed</p>
                <p className="text-3xl font-bold text-blue-700 mt-2">{batch.files_processed}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-4 hover:shadow-md transition-all">
                <p className="text-amber-600 text-xs font-bold uppercase tracking-wider">Duplicates Found</p>
                <p className="text-3xl font-bold text-amber-700 mt-2">{batch.duplicates_found}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-lg p-4 hover:shadow-md transition-all">
                <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider">Approved Merges</p>
                <p className="text-3xl font-bold text-emerald-700 mt-2">{batch.duplicates_approved}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4 hover:shadow-md transition-all">
                <p className="text-purple-600 text-xs font-bold uppercase tracking-wider">New Candidates</p>
                <p className="text-3xl font-bold text-purple-700 mt-2">{batch.new_candidates_created}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Parsed Files Section */}
        <div className="mb-6">
          <ComprehensiveDataTable files={batch.files} batchName={batch.batch_name} />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/admin/bulk-upload/review')}
            className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Review Matches ({Math.max(0, batch.duplicates_found - batch.duplicates_approved - batch.duplicates_rejected)})
          </button>
          <button
            onClick={() => router.push('/admin/bulk-uploads')}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-lg transition-all"
          >
            Back to Batches
          </button>
        </div>
      </div>
    </div>
  );
}
