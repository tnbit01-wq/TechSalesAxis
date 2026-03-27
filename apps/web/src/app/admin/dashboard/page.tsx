/**
 * Admin Dashboard Home Page
 * Shows overview of bulk uploads, recent activity, and quick actions
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BulkUploadBatch {
  id: string;
  batch_name: string;
  upload_status: string;
  total_files_uploaded: number;
  successfully_parsed: number;
  duplicate_candidates_detected: number;
  new_candidates_identified: number;
  created_at: string;
}

interface DashboardStats {
  total_batches: number;
  total_resumes: number;
  duplicates_found: number;
  new_candidates: number;
  recent_batches: BulkUploadBatch[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/v1/admin/dashboard/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to fetch dashboard stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
          </div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-100">
        <div className="text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="mt-4 inline-block px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage bulk resume uploads and candidate profiles</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Batches Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Batches</p>
                <p className="text-4xl font-bold text-gray-800 mt-2">
                  {stats?.total_batches || 0}
                </p>
              </div>
              <div className="text-4xl text-blue-500">📁</div>
            </div>
          </div>

          {/* Total Resumes Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Resumes</p>
                <p className="text-4xl font-bold text-gray-800 mt-2">
                  {stats?.total_resumes || 0}
                </p>
              </div>
              <div className="text-4xl text-green-500">📄</div>
            </div>
          </div>

          {/* Duplicates Found Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Duplicates Found</p>
                <p className="text-4xl font-bold text-gray-800 mt-2">
                  {stats?.duplicates_found || 0}
                </p>
              </div>
              <div className="text-4xl text-orange-500">↔️</div>
            </div>
          </div>

          {/* New Candidates Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">New Candidates</p>
                <p className="text-4xl font-bold text-gray-800 mt-2">
                  {stats?.new_candidates || 0}
                </p>
              </div>
              <div className="text-4xl text-purple-500">👥</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link
            href="/admin/bulk-upload"
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-6 hover:shadow-lg transition transform hover:scale-105"
          >
            <div className="text-3xl mb-2">📤</div>
            <h3 className="font-bold text-lg">New Upload</h3>
            <p className="text-blue-100 text-sm mt-1">Upload 500-1000 resumes</p>
          </Link>

          <Link
            href="/admin/bulk-uploads"
            className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg p-6 hover:shadow-lg transition transform hover:scale-105"
          >
            <div className="text-3xl mb-2">📋</div>
            <h3 className="font-bold text-lg">View Batches</h3>
            <p className="text-teal-100 text-sm mt-1">Manage all uploads</p>
          </Link>

          <Link
            href="/admin/bulk-upload/review"
            className="bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg p-6 hover:shadow-lg transition transform hover:scale-105"
          >
            <div className="text-3xl mb-2">⚠️</div>
            <h3 className="font-bold text-lg">Review Duplicates</h3>
            <p className="text-orange-100 text-sm mt-1">Approve/reject matches</p>
          </Link>

          <Link
            href="/admin/settings"
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg p-6 hover:shadow-lg transition transform hover:scale-105"
          >
            <div className="text-3xl mb-2">⚙️</div>
            <h3 className="font-bold text-lg">Settings</h3>
            <p className="text-purple-100 text-sm mt-1">Configure settings</p>
          </Link>
        </div>

        {/* Recent Batches */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Recent Uploads</h2>
          
          {stats?.recent_batches && stats.recent_batches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Batch Name</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Files</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Parsed</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Duplicates</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">New</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_batches.map((batch) => (
                    <tr key={batch.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-800">{batch.batch_name}</td>
                      <td className="py-3 px-4 text-gray-600">{batch.total_files_uploaded}</td>
                      <td className="py-3 px-4 text-gray-600">{batch.successfully_parsed}</td>
                      <td className="py-3 px-4 text-orange-600 font-semibold">{batch.duplicate_candidates_detected}</td>
                      <td className="py-3 px-4 text-green-600 font-semibold">{batch.new_candidates_identified}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          batch.upload_status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : batch.upload_status === 'processing'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {batch.upload_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {new Date(batch.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/bulk-upload/${batch.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No batches uploaded yet</p>
              <Link href="/admin/bulk-upload" className="text-blue-600 hover:underline mt-2 inline-block">
                Start your first bulk upload →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
