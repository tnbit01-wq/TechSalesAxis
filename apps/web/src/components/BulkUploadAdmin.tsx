/*
BULK UPLOAD ADMIN INTERFACE - REACT COMPONENTS
Next.js TypeScript Components for admin dashboard

Author: Implementation Team  
Date: March 26, 2026
Purpose: Admin interface for bulk resume uploads and duplicate resolution
*/

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { awsAuth } from '@/lib/awsAuth';

// Component 1: Bulk Upload Initialization Screen
const BulkUploadInitialize: React.FC = () => {
  const [batchName, setBatchName] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [sourceSystem, setSourceSystem] = useState('internal_hr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = awsAuth.getToken();
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
      const response = await fetch(`${apiUrl}/api/v1/bulk-upload/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_name: batchName,
          batch_description: batchDescription,
          source_system: sourceSystem,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed or session expired. Please log in again.');
        }
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || 'Failed to initialize upload');
      }

      const data = await response.json();
      // Redirect to file upload page
      router.push(`/admin/bulk-upload/${data.bulk_upload_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Initiate Bulk Upload</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Batch Name */}
        <div>
          <label className="block text-sm font-medium mb-2">Batch Name *</label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g., Q1 2026 Campus Hire"
            required
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Batch Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={batchDescription}
            onChange={(e) => setBatchDescription(e.target.value)}
            placeholder="e.g., Referral candidates from TechConf 2026"
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Source System */}
        <div>
          <label className="block text-sm font-medium mb-2">Source System</label>
          <select
            value={sourceSystem}
            onChange={(e) => setSourceSystem(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="internal_hr">Internal HR</option>
            <option value="recruitment_agency">Recruitment Agency</option>
            <option value="headhunter">Headhunter</option>
          </select>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !batchName}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700"
        >
          {loading ? 'Creating...' : 'Create Batch & Continue to Upload'}
        </button>
      </form>
    </div>
  );
};

// ============================================================================
// Component 2: File Upload Screen
// ============================================================================

interface UploadProgress {
  id: string;
  serverFileId?: string;
  filename: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const BulkUploadFileUpload: React.FC<{ bulkUploadId: string; onUploadComplete?: () => void }> = ({ bulkUploadId, onUploadComplete }) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [reparsing, setReparsing] = useState<Record<string, boolean>>({});

  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToastMessages((prev) => [...prev.slice(-3), { id: toastId, message, type }]);
    window.setTimeout(() => {
      setToastMessages((prev) => prev.filter((toast) => toast.id !== toastId));
    }, 4500);
  };

  const pollFileStatus = async (uiId: string, serverFileId: string, filename: string, attempt = 0) => {
    const token = awsAuth.getToken();
    if (!token) {
      addToast('Authentication required to track file status', 'error');
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(
        `${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/file/${serverFileId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Status fetch failed (${response.status})`);
      }

      const fileStatus = await response.json();
      const parsingStatus = fileStatus.parsing_status;

      if (parsingStatus === 'completed') {
        setUploadProgress((prev) =>
          prev.map((item) =>
            item.id === uiId
              ? { ...item, status: 'completed', progress: 100 }
              : item
          )
        );
        addToast(`Parsed: ${filename}`, 'success');
        return;
      }

      if (parsingStatus === 'failed') {
        setUploadProgress((prev) =>
          prev.map((item) =>
            item.id === uiId
              ? {
                  ...item,
                  status: 'failed',
                  error: fileStatus.parsing_error || 'Parsing failed',
                  progress: 100,
                }
              : item
          )
        );
        addToast(`Parse failed: ${filename}`, 'error');
        return;
      }

      if (attempt >= 25) {
        setUploadProgress((prev) =>
          prev.map((item) =>
            item.id === uiId
              ? {
                  ...item,
                  status: 'failed',
                  error: 'Timed out waiting for parse result',
                  progress: 100,
                }
              : item
          )
        );
        addToast(`Timeout waiting for ${filename}`, 'error');
        return;
      }

      setTimeout(() => pollFileStatus(uiId, serverFileId, filename, attempt + 1), 3000);
    } catch (error) {
      if (attempt < 5) {
        setTimeout(() => pollFileStatus(uiId, serverFileId, filename, attempt + 1), 3000);
        return;
      }

      setUploadProgress((prev) =>
        prev.map((item) =>
          item.id === uiId
            ? {
                ...item,
                status: 'failed',
                error: 'Unable to read parsing status',
                progress: 100,
              }
            : item
        )
      );
      addToast(`Status tracking failed for ${filename}`, 'error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleReparse = async (uiId: string, serverFileId: string | undefined, filename: string) => {
    if (!serverFileId) {
      addToast(`Cannot reparse ${filename}: missing file id`, 'error');
      return;
    }

    setReparsing((prev) => ({ ...prev, [uiId]: true }));

    try {
      const token = awsAuth.getToken();
      if (!token) {
        addToast('Authentication required to reparse file', 'error');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(
        `${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/file/${serverFileId}/reparse`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
        addToast(`Reparse failed: ${err.detail || 'unknown error'}`, 'error');
      } else {
        setUploadProgress((prev) =>
          prev.map((item) =>
            item.id === uiId
              ? { ...item, status: 'processing', error: undefined }
              : item
          )
        );
        addToast(`Reparse queued: ${filename}`, 'success');
        pollFileStatus(uiId, serverFileId, filename);
      }
    } catch (error) {
      addToast(`Reparse error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setReparsing((prev) => ({ ...prev, [uiId]: false }));
    }
  };

  const handleFiles = async (files: FileList) => {
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uiId = `${Date.now()}-${i}`;

      setUploadProgress((prev) => [
        ...prev,
        { id: uiId, filename: file.name, status: 'uploading', progress: 0 },
      ]);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_token', 'token123');

      try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress((prev) =>
              prev.map((p) => (p.id === uiId ? { ...p, progress } : p))
            );
          }
        });

        xhr.addEventListener('load', async () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText || '{}');
            const serverFileId = data.file_id;
            setUploadProgress((prev) =>
              prev.map((p) =>
                p.id === uiId
                  ? { ...p, status: 'processing', progress: 100, serverFileId }
                  : p
              )
            );
            if (serverFileId) {
              pollFileStatus(uiId, serverFileId, file.name);
            }
          } else {
            setUploadProgress((prev) =>
              prev.map((p) =>
                p.id === uiId
                  ? { ...p, status: 'failed', error: 'Upload failed', progress: 100 }
                  : p
              )
            );
            addToast(`Upload failed: ${file.name}`, 'error');
          }
        });

        xhr.addEventListener('error', () => {
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.id === uiId
                ? { ...p, status: 'failed', error: 'Network error', progress: 100 }
                : p
            )
          );
          addToast(`Network error uploading ${file.name}`, 'error');
        });

        const token = awsAuth.getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        xhr.open('POST', `${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/upload`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      } catch (error) {
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.id === uiId
              ? { ...p, status: 'failed', error: 'Upload error', progress: 100 }
              : p
          )
        );
        addToast(`Upload error: ${file.name}`, 'error');
      }
    }

    setUploading(false);
  };

  const uploadedCount = uploadProgress.filter((p) => p.status !== 'uploading').length;
  const totalFiles = uploadProgress.length;
  const completedCount = uploadProgress.filter((p) => p.status === 'completed').length;
  const failedCount = uploadProgress.filter((p) => p.status === 'failed').length;
  const processedCount = uploadProgress.filter((p) => p.status === 'completed' || p.status === 'failed').length;
  const overallProgress = totalFiles ? Math.round((processedCount / totalFiles) * 100) : 0;
  const canContinue = totalFiles > 0 && processedCount === totalFiles && !uploading;

  return (
    <div className="max-w-4xl mx-auto p-6 relative">
      <div className="fixed top-6 right-6 z-50 space-y-3">
        {toastMessages.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm rounded-lg px-4 py-3 shadow-lg text-sm font-medium text-white ${
              toast.type === 'success'
                ? 'bg-emerald-600'
                : toast.type === 'error'
                ? 'bg-red-600'
                : 'bg-blue-600'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold mb-6">Upload Resume Files</h2>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Batch upload progress</p>
            <p className="text-2xl font-semibold">{overallProgress}% complete</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <div>{processedCount} processed</div>
            <div>{failedCount} failed</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
        }`}
      >
        <p className="text-lg font-medium mb-2">📄 Drag & drop resume files here</p>
        <p className="text-gray-600 text-sm mb-4">or</p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="sr-only"
          />
          <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
            Browse Files
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-4">Max 10MB per file • PDF, DOC, DOCX</p>
      </div>

      <div className="mt-8 space-y-4">
        {uploadProgress.map((item) => (
          <div key={item.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex flex-wrap justify-between gap-4 pb-3">
              <div className="space-y-1">
                <p className="font-medium">{item.filename}</p>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  {item.status === 'processing' && (
                    <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-blue-600" />
                  )}
                  <span>
                    {item.status === 'uploading' && 'Uploading'}
                    {item.status === 'processing' && 'Processing'}
                    {item.status === 'completed' && 'Completed'}
                    {item.status === 'failed' && 'Failed'}
                  </span>
                </div>
              </div>
              <span className="text-sm text-slate-500">{item.progress}%</span>
            </div>
            <div className="w-full rounded-full bg-slate-200 h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.status === 'failed'
                    ? 'bg-red-500'
                    : item.status === 'completed'
                    ? 'bg-emerald-600'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${item.progress}%` }}
              />
            </div>
            {item.status === 'processing' && (
              <p className="mt-2 text-sm text-slate-500">Parsing resume, please wait...</p>
            )}
            {item.error && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-sm text-red-600">{item.error}</p>
                {item.serverFileId && (
                  <button
                    onClick={() => handleReparse(item.id, item.serverFileId, item.filename)}
                    disabled={reparsing[item.id]}
                    className="self-start rounded-md bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {reparsing[item.id] ? 'Reparsing...' : 'Reparse'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {uploadProgress.length > 0 && (
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p>
            <strong>{uploadedCount}</strong> files submitted •{' '}
            <strong>{failedCount}</strong> failed •{' '}
            <strong>{processedCount}</strong> processed
          </p>
        </div>
      )}

      <button
        onClick={() => onUploadComplete?.()}
        disabled={!canContinue}
        className="mt-8 w-full rounded-lg bg-blue-600 px-6 py-3 text-white font-medium disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-700"
      >
        {canContinue ? 'Continue to Review Duplicates' : 'Waiting for remaining files to finish'}
      </button>
    </div>
  );
};

// ============================================================================
// Component 3: Duplicate Review Dashboard
// ============================================================================

interface DuplicateMatch {
  match_id: string;
  match_confidence: number;
  match_type: string;
  extracted_name: string;
  extracted_email: string;
  existing_candidate_name: string;
  match_details: Record<string, any>;
}

const BulkUploadDuplicateReview: React.FC<{ bulkUploadId: string; onReviewComplete?: () => void }> = ({ bulkUploadId, onReviewComplete }) => {
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [allReviewed, setAllReviewed] = useState(false);

  useEffect(() => {
    fetchDuplicates();
  }, [bulkUploadId]);

  useEffect(() => {
    if (duplicates.length > 0 && Object.keys(decisions).length === duplicates.length) {
      setAllReviewed(true);
      const timer = setTimeout(() => {
        onReviewComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [decisions, duplicates.length, onReviewComplete]);

  const fetchDuplicates = async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(
        `${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/duplicates-for-review`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setDuplicates(data);
      }
    } catch (error) {
      console.error('Failed to fetch duplicates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (matchId: string, decision: string) => {
    setDecisions((prev) => ({ ...prev, [matchId]: decision }));

    try {
      const token = awsAuth.getToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(
        `${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/duplicate/${matchId}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            admin_decision: decision,
            decision_reason: decision === 'approved_merge' ? 'Confirmed duplicate' : 'Not duplicate',
          }),
        }
      );

      if (response.ok && currentIndex < duplicates.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (error) {
      console.error('Failed to submit decision:', error);
    }
  };

  if (loading) return <div className="p-6">Loading duplicates...</div>;
  if (duplicates.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-lg mb-4">✓ No duplicates requiring review!</p>
        <button
          onClick={() => onReviewComplete?.()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Proceed to Status Dashboard
        </button>
      </div>
    );
  }

  if (allReviewed) {
    return (
      <div className="p-6 text-center">
        <p className="text-2xl mb-4">✓ All duplicates reviewed!</p>
        <p className="text-gray-600">Proceeding to status dashboard...</p>
      </div>
    );
  }

  const current = duplicates[currentIndex];
  const confidence = Math.round(current.match_confidence * 100);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Review Potential Duplicates</h2>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>
            {currentIndex + 1} of {duplicates.length}
          </span>
          <span>{Math.round(((currentIndex + 1) / duplicates.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / duplicates.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card: Duplicate Pair */}
      <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
        {/* Confidence Score */}
        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
          <span className="font-semibold">Confidence Score</span>
          <span className={`text-2xl font-bold ${
            confidence > 90 ? 'text-green-600' : 'text-orange-600'
          }`}>
            {confidence}%
          </span>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-8">
          {/* Uploaded Resume */}
          <div className="border-l-4 border-blue-600 pl-4">
            <p className="text-xs uppercase tracking-wide text-gray-600 mb-2">📤 Uploaded Resume</p>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{current.extracted_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-mono text-sm">{current.extracted_email}</p>
              </div>
            </div>
          </div>

          {/* Existing Candidate */}
          <div className="border-l-4 border-purple-600 pl-4">
            <p className="text-xs uppercase tracking-wide text-gray-600 mb-2">👤 Existing Candidate</p>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{current.existing_candidate_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Match Reason</p>
                <p className="text-sm">{current.match_type}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Matching Details */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="font-semibold mb-3">Match Details</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {Object.entries(current.match_details).map(([key, value]) => (
              <div key={key}>
                <p className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="font-medium">{JSON.stringify(value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Decision Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            onClick={() => handleDecision(current.match_id, 'approved_merge')}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
          >
            ✓ Confirm Duplicate (Merge)
          </button>
          <button
            onClick={() => handleDecision(current.match_id, 'rejected_duplicate')}
            className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700"
          >
            ✗ Not Duplicate (Create New)
          </button>
        </div>
      </div>

      {/* Next indicator */}
      {currentIndex < duplicates.length - 1 && (
        <p className="text-center text-sm text-gray-600 mt-6">
          Next: {duplicates[currentIndex + 1].extracted_name}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Component 4: Bulk Upload Status Dashboard
// ============================================================================

interface FileItem {
  id: string;
  filename: string;
  parsing_status: string;
  extracted_name?: string;
  extracted_email?: string;
  error_message?: string;
  created_at?: string;
}

const BulkUploadStatusDashboard: React.FC<{ bulkUploadId: string }> = ({ bulkUploadId }) => {
  const [status, setStatus] = useState<any>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reparsing, setReparsing] = useState<Record<string, boolean>>({});
  const [bulkReparsing, setBulkReparsing] = useState(false);
  const [toastMessages, setToastMessages] = useState<Array<{ id: string; message: string; type: string }>>([]);

  const addToast = (message: string, type: string = 'info') => {
    const id = `${Date.now()}`;
    setToastMessages((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToastMessages((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const fetchStatusAndFiles = async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Fetch batch status
      const statusResponse = await fetch(`${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (statusResponse.ok) {
        setStatus(await statusResponse.json());
      }

      // Fetch files list
      const filesResponse = await fetch(`${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/files`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (filesResponse.ok) {
        setFiles(await filesResponse.json());
      } else if (filesResponse.status === 404) {
        console.warn('Files endpoint not available, using empty list');
        setFiles([]);
      }
    } catch (error) {
      console.error('Failed to fetch status/files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndFiles();
    const interval = setInterval(fetchStatusAndFiles, 5000);
    return () => clearInterval(interval);
  }, [bulkUploadId]);

  const handleReparse = async (fileId: string, filename: string) => {
    setReparsing((prev) => ({ ...prev, [fileId]: true }));
    try {
      const token = awsAuth.getToken();
      if (!token) {
        addToast('Authentication required', 'error');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/file/${fileId}/reparse`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        addToast(`Reparse queued for ${filename}`, 'success');
        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, parsing_status: 'processing', error_message: null } : f)));
        // Refresh status after a short delay
        setTimeout(() => fetchStatusAndFiles(), 1000);
      } else {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        addToast(`Reparse failed: ${error.detail || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      addToast(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setReparsing((prev) => ({ ...prev, [fileId]: false }));
    }
  };

  const handleBulkReparse = async () => {
    setBulkReparsing(true);
    try {
      const token = awsAuth.getToken();
      if (!token) {
        addToast('Authentication required', 'error');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/reparse-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        addToast(`Bulk reparse failed: ${error.detail || 'Unknown error'}`, 'error');
        return;
      }

      const data = await response.json();
      addToast(
        `Bulk reparse queued: ${data.queued_count || 0} files queued, ${data.skipped_count || 0} already active`,
        'success'
      );
      setFiles((prev) => prev.map((f) => (f.parsing_status === 'parsed' || f.parsing_status === 'completed' ? f : { ...f, parsing_status: 'processing', error_message: null })));
      setTimeout(() => fetchStatusAndFiles(), 1000);
    } catch (error) {
      addToast(`Bulk reparse error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setBulkReparsing(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!status) return <div className="p-6">Failed to load status</div>;

  const isProcessing = status.upload_status === 'processing';
  const processedCount = status.successfully_parsed + status.parsing_failed;
  const totalProgress = status.total_files_uploaded
    ? Math.round((processedCount / status.total_files_uploaded) * 100)
    : 0;
  const duplicatesReviewPercent = status.duplicate_candidates_detected
    ? Math.round((Math.min(status.duplicates_admin_reviewed, status.duplicate_candidates_detected) / status.duplicate_candidates_detected) * 100)
    : 0;
  const canReparseFile = (parsingStatus: string) => {
    const normalized = (parsingStatus || '').toLowerCase();
    return normalized !== 'parsed' && normalized !== 'completed' && normalized !== 'processing' && normalized !== 'scanning';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Toast Messages */}
      <div className="fixed top-6 right-6 z-50 space-y-3">
        {toastMessages.map((toast) => (
          <div
            key={toast.id}
            className={`max-w-sm rounded-lg px-4 py-3 shadow-lg text-sm font-medium text-white ${
              toast.type === 'success'
                ? 'bg-emerald-600'
                : toast.type === 'error'
                ? 'bg-red-600'
                : 'bg-blue-600'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <h1 className="text-3xl font-bold mb-8">{status.batch_name}</h1>

      {/* Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600">Files Uploaded</p>
          <p className="text-2xl font-bold">{status.total_files_uploaded}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600">Successfully Parsed</p>
          <p className="text-2xl font-bold">{status.successfully_parsed}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <p className="text-sm text-gray-600">Parse Failed</p>
          <p className="text-2xl font-bold">{status.parsing_failed || 0}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-600">New Candidates</p>
          <p className="text-2xl font-bold">{status.new_candidates_identified}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-500">Overall processing progress</p>
            <p className="text-3xl font-semibold text-slate-900">{Math.round(totalProgress)}%</p>
          </div>
          <div className="text-sm text-slate-600">
            <div>{processedCount} of {status.total_files_uploaded} files processed</div>
            <div>{status.job_queue_size} jobs remaining</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${totalProgress}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={handleBulkReparse}
            disabled={bulkReparsing}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {bulkReparsing ? 'Queuing reparse...' : 'Reparse All Pending/Failed'}
          </button>
          <span className="text-sm text-slate-500 self-center">
            Use this when the batch times out or files stay pending.
          </span>
        </div>
      </div>

      {/* Duplicate Review Progress */}
      {status.duplicate_candidates_detected > 0 && (
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Duplicate review progress</p>
              <p className="text-lg font-semibold text-slate-900">{duplicatesReviewPercent}%</p>
            </div>
            <div className="text-sm text-slate-600">
              Reviewed {status.duplicates_admin_reviewed} of {status.duplicate_candidates_detected}
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${duplicatesReviewPercent}%` }} />
          </div>
        </div>
      )}

      {/* Detailed File Listing */}
      {files.length > 0 && (
        <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">File Details</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{file.filename}</p>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        file.parsing_status === 'parsed' || file.parsing_status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : file.parsing_status === 'error' || file.parsing_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : file.parsing_status === 'processing'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {file.parsing_status === 'parsed' || file.parsing_status === 'completed'
                        ? '✓ Parsed'
                        : file.parsing_status === 'error' || file.parsing_status === 'failed'
                        ? '✗ Failed'
                        : file.parsing_status === 'processing'
                        ? '⏳ Processing'
                        : 'Pending'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {file.extracted_name && <p>Name: {file.extracted_name}</p>}
                    {file.extracted_email && <p>Email: {file.extracted_email}</p>}
                    {file.error_message && <p className="text-red-600">Error: {file.error_message}</p>}
                  </div>
                </div>
                  <button
                    onClick={async () => {
                      try {
                        const token = awsAuth.getToken();
                        if (!token) {
                          addToast('Authentication required', 'error');
                          return;
                        }

                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
                        const response = await fetch(`${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/file/${file.id}/view`, {
                          headers: { 'Authorization': `Bearer ${token}` },
                        });

                        if (!response.ok) {
                          const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                          addToast(`View failed: ${error.detail || 'Unknown error'}`, 'error');
                          return;
                        }

                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank', 'noopener,noreferrer');
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                      } catch (error) {
                        addToast(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                      }
                    }}
                    className="ml-4 px-3 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 whitespace-nowrap"
                  >
                    View File
                  </button>
                {canReparseFile(file.parsing_status) && (
                  <button
                    onClick={() => handleReparse(file.id, file.filename)}
                    disabled={reparsing[file.id]}
                    className="ml-4 px-3 py-1 text-xs font-medium bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {reparsing[file.id] ? 'Reparsing...' : 'Reparse'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-blue-50 p-4 rounded-lg mb-8 border border-blue-200">
          <p className="font-semibold mb-2">⏳ Processing in Progress</p>
          <p className="text-sm text-gray-700">{status.job_queue_size} jobs remaining in queue</p>
        </div>
      )}

      {/* Success Message */}
      {!isProcessing && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-green-700">
          ✓ Processing Complete
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component: BulkUploadAdmin (Orchestrates the entire workflow)
// ============================================================================

interface BulkUploadAdminProps {
  onBatchCreated?: (batchId: string) => void;
  onUploadComplete?: () => void;
}

const BulkUploadAdmin: React.FC<BulkUploadAdminProps> = ({
  onBatchCreated,
  onUploadComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<
    'initialize' | 'upload' | 'duplicate_review' | 'status' | 'complete'
  >('initialize');
  const [bulkUploadId, setBulkUploadId] = useState<string | null>(null);

  const handleBatchCreated = (batchId: string) => {
    setBulkUploadId(batchId);
    setCurrentStep('upload');
    onBatchCreated?.(batchId);
  };

  const handleUploadComplete = () => {
    if (bulkUploadId) {
      setCurrentStep('duplicate_review');
    }
  };

  const handleDuplicateReviewComplete = () => {
    setCurrentStep('status');
  };

  const handleStatusComplete = () => {
    setCurrentStep('complete');
    onUploadComplete?.();
  };

  return (
    <div>
      {currentStep === 'initialize' && (
        <BulkUploadInitializeWrapper onBatchCreated={handleBatchCreated} />
      )}
      {currentStep === 'upload' && bulkUploadId && (
        <BulkUploadFileUploadWrapper
          bulkUploadId={bulkUploadId}
          onUploadComplete={handleUploadComplete}
        />
      )}
      {currentStep === 'duplicate_review' && bulkUploadId && (
        <BulkUploadDuplicateReviewWrapper
          bulkUploadId={bulkUploadId}
          onReviewComplete={handleDuplicateReviewComplete}
        />
      )}
      {currentStep === 'status' && bulkUploadId && (
        <BulkUploadStatusDashboardWrapper
          bulkUploadId={bulkUploadId}
          onStatusComplete={handleStatusComplete}
        />
      )}
      {currentStep === 'complete' && (
        <div className="p-6 text-center">
          <div className="mb-4">
            <span className="text-5xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-green-700">Upload Complete!</h2>
          <p className="text-gray-600 mt-2">Redirecting to dashboard...</p>
        </div>
      )}
    </div>
  );
};

// Wrapper components to handle onComplete callbacks
const BulkUploadInitializeWrapper: React.FC<{
  onBatchCreated: (batchId: string) => void;
}> = ({ onBatchCreated }) => {
  const [batchName, setBatchName] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [sourceSystem, setSourceSystem] = useState('internal_hr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Get authentication token
      const token = awsAuth.getToken();
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
      const response = await fetch(`${apiUrl}/api/v1/bulk-upload/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_name: batchName,
          batch_description: batchDescription,
          source_system: sourceSystem,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to initialize upload');
      }

      const data = await response.json();
      onBatchCreated(data.bulk_upload_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Initiate Bulk Upload</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium mb-2">Batch Name *</label>
          <input
            type="text"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="e.g., Q1 2026 Campus Hire"
            required
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            value={batchDescription}
            onChange={(e) => setBatchDescription(e.target.value)}
            placeholder="e.g., Referral candidates from TechConf 2026"
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Source System</label>
          <select
            value={sourceSystem}
            onChange={(e) => setSourceSystem(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="internal_hr">Internal HR</option>
            <option value="recruitment_agency">Recruitment Agency</option>
            <option value="headhunter">Headhunter</option>
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating batch...' : 'Create Batch & Continue'}
        </button>
      </form>
    </div>
  );
};

const BulkUploadFileUploadWrapper: React.FC<{
  bulkUploadId: string;
  onUploadComplete: () => void;
}> = ({ bulkUploadId, onUploadComplete }) => {
  return <BulkUploadFileUpload bulkUploadId={bulkUploadId} onUploadComplete={onUploadComplete} />;
};

const BulkUploadDuplicateReviewWrapper: React.FC<{
  bulkUploadId: string;
  onReviewComplete: () => void;
}> = ({ bulkUploadId, onReviewComplete }) => {
  return <BulkUploadDuplicateReview bulkUploadId={bulkUploadId} onReviewComplete={onReviewComplete} />;
};

const BulkUploadStatusDashboardWrapper: React.FC<{
  bulkUploadId: string;
  onStatusComplete: () => void;
}> = ({ bulkUploadId, onStatusComplete }) => {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          console.error('No auth token found');
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        const response = await fetch(`${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.upload_status !== 'processing') {
            setIsComplete(true);
            setTimeout(() => {
              onStatusComplete();
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Failed to check status:', error);
      }
    };

    const interval = setInterval(checkStatus, 2000);
    checkStatus();
    return () => clearInterval(interval);
  }, [bulkUploadId, onStatusComplete]);

  return <BulkUploadStatusDashboard bulkUploadId={bulkUploadId} />;
};

export default BulkUploadAdmin;

// Also export named components for direct usage if needed
export {
  BulkUploadInitialize,
  BulkUploadFileUpload,
  BulkUploadDuplicateReview,
  BulkUploadStatusDashboard,
};
