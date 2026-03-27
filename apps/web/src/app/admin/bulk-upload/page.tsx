/**
 * Admin Bulk Upload Page
 * Main interface for bulk upload - Initialize batch and upload resumes
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import BulkUploadAdmin from '@/components/BulkUploadAdmin';

export default function AdminBulkUploadPage() {
  const router = useRouter();
  const [batchCreated, setBatchCreated] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  const handleBatchCreated = (batchId: string) => {
    setBatchCreated(true);
    setCurrentBatchId(batchId);
  };

  const handleUploadComplete = () => {
    // Redirect back to dashboard after successful upload
    setTimeout(() => {
      router.push('/admin/dashboard');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back
            </button>
            <button
              onClick={() => router.push('/admin/bulk-uploads')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              View All Batches →
            </button>
          </div>
          <h1 className="text-4xl font-bold text-gray-800">Bulk Upload Resumes</h1>
          <p className="text-gray-600 mt-2">
            Upload 500-1000 resumes at once. Max batch size: 500 MB per upload.
          </p>
        </div>

        {/* Information Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-lg mb-8">
          <div className="flex items-start">
            <div className="text-2xl mr-4">ℹ️</div>
            <div>
              <h3 className="font-bold text-blue-900 mb-2">How Bulk Upload Works</h3>
              <ul className="text-blue-800 text-sm space-y-1 ml-4 list-disc">
                <li><strong>Upload:</strong> Choose 1-1000 resumes (PDF, DOC, DOCX, TXT)</li>
                <li><strong>Parse:</strong> Automatically extract name, email, skills, experience</li>
                <li><strong>Duplicate Detection:</strong> Identify matches with existing candidates (70-100% confidence)</li>
                <li><strong>Review:</strong> Admin reviews flagged duplicates and approves merges</li>
                <li><strong>Create Accounts:</strong> New resumes become "shadow profiles" - candidates verify via email</li>
                <li><strong>Verification:</strong> Candidates register device and email to activate profiles</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Storage Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Storage Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Max File Size</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">50 MB</p>
              <p className="text-xs text-gray-500 mt-2">Per file</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Max Batch Size</p>
              <p className="text-2xl font-bold text-green-600 mt-1">500 MB</p>
              <p className="text-xs text-gray-500 mt-2">Total per batch</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600 text-sm">Supported Formats</p>
              <p className="text-sm font-mono text-purple-600 mt-1">PDF, DOC, DOCX, TXT</p>
              <p className="text-xs text-gray-500 mt-2">Any text-based resume</p>
            </div>
          </div>
        </div>

        {/* Bulk Upload Component */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <BulkUploadAdmin
            onBatchCreated={handleBatchCreated}
            onUploadComplete={handleUploadComplete}
          />
        </div>

        {/* Current Batch Info */}
        {currentBatchId && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center">
              <span className="text-3xl mr-4">✅</span>
              <div>
                <h3 className="font-bold text-green-900">Batch Created Successfully</h3>
                <p className="text-green-800 text-sm mt-1">
                  Batch ID: <code className="bg-green-100 px-2 py-1 rounded">{currentBatchId}</code>
                </p>
                <p className="text-green-700 text-sm mt-2">
                  Files are being processed. You can monitor progress on the dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Help */}
        <div className="mt-12 text-center text-gray-600">
          <p className="text-sm">
            📞 Need help? Contact:{' '}
            <a href="mailto:admin@talentflow.com" className="text-blue-600 hover:underline">
              admin@talentflow.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
