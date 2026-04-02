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

// Component 1: Bulk Upload Initialization Screen
export const BulkUploadInitialize: React.FC = () => {
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
      const response = await fetch(`${apiUrl}/api/v1/bulk-upload/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_name: batchName,
          batch_description: batchDescription,
          source_system: sourceSystem,
        }),
      });

      if (!response.ok) throw new Error('Failed to initialize upload');

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
  fileId: string;
  filename: string;
  status: 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
}

export const BulkUploadFileUpload: React.FC<{ bulkUploadId: string; onUploadComplete?: () => void }> = ({ bulkUploadId, onUploadComplete }) => {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [allUploadedCount, setAllUploadedCount] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    
    // Convert FileList to Array to process sequentially
    const fileArray = Array.from(files);

    for (const [index, file] of fileArray.entries()) {
      const fileId = `${Date.now()}-${index}`;

      // Add to progress tracking
      setUploadProgress((prev) => [
        ...prev,
        { fileId, filename: file.name, status: 'uploading', progress: 0 },
      ]);

      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_token', 'bulk_upload_v1'); 

      try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadProgress((prev) =>
              prev.map((p) => (p.fileId === fileId ? { ...p, progress } : p))
            );
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 201) {
            const response = JSON.parse(xhr.responseText);
            setUploadProgress((prev) =>
              prev.map((p) =>
                p.fileId === fileId
                  ? { ...p, status: response.status || 'queued', progress: 100 }
                  : p
              )
            );
            setAllUploadedCount((c) => c + 1);
          } else {
            let errorMessage = 'Upload failed';
            try {
               const errData = JSON.parse(xhr.responseText);
               errorMessage = errData.detail || errorMessage;
            } catch {}
            
            setUploadProgress((prev) =>
              prev.map((p) =>
                p.fileId === fileId
                  ? { ...p, status: 'failed', error: errorMessage }
                  : p
              )
            );
          }
        });

        xhr.addEventListener('error', () => {
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.fileId === fileId
                ? { ...p, status: 'failed', error: 'Network Connection Error' }
                : p
            )
          );
        });

        const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : '';
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
        xhr.open('POST', `${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/upload`);
        
        // Set Authorization header
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        
        xhr.send(formData);
      } catch (error) {
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.fileId === fileId
              ? { ...p, status: 'failed', error: 'Internal Error' }
              : p
          )
        );
      }
    }

    setUploading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Upload Resume Files</h2>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
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

      {/* Upload Progress */}
      <div className="mt-8 space-y-4">
        {uploadProgress.map((item) => (
          <div key={item.fileId} className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{item.filename}</span>
              <span className="text-sm text-gray-600">{item.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  item.status === 'failed'
                    ? 'bg-red-600'
                    : item.status === 'completed'
                    ? 'bg-green-600'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${item.progress}%` }}
              />
            </div>
            {item.status === 'processing' && (
              <p className="text-xs text-gray-600 mt-1">Scanning & parsing...</p>
            )}
            {item.error && (
              <p className="text-xs text-red-600 mt-1">{item.error}</p>
            )}
          </div>
        ))}
      </div>

      {/* Status Summary */}
      {uploadProgress.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm">
            <strong>{allUploadedCount}</strong> files uploaded •{' '}
            <strong>{uploadProgress.filter((p) => p.status === 'failed').length}</strong> failed
          </p>
        </div>
      )}

      {/* Next Button */}
      <button
        onClick={() => onUploadComplete?.()}
        disabled={allUploadedCount === 0 || uploading}
        className="mt-8 px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700"
      >
        Continue to Review Duplicates
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

export const BulkUploadDuplicateReview: React.FC<{ bulkUploadId: string; onReviewComplete?: () => void }> = ({ bulkUploadId, onReviewComplete }) => {
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
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

export const BulkUploadStatusDashboard: React.FC<{ bulkUploadId: string }> = ({ bulkUploadId }) => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
        if (!token) {
          console.error('No auth token found');
          setLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
        const response = await fetch(`${apiUrl}/api/v1/bulk-upload/${bulkUploadId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          setStatus(await response.json());
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [bulkUploadId]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!status) return <div className="p-6">Failed to load status</div>;

  const isProcessing = status.upload_status === 'processing';

  return (
    <div className="max-w-6xl mx-auto p-6">
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
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <p className="text-sm text-gray-600">Duplicates Detected</p>
          <p className="text-2xl font-bold">{status.duplicate_candidates_detected}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <p className="text-sm text-gray-600">New Candidates</p>
          <p className="text-2xl font-bold">{status.new_candidates_identified}</p>
        </div>
      </div>

      {/* Processing Queue */}
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      if (!token) {
        throw new Error('Authentication token not found. Please login.');
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
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
        const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
        if (!token) {
          console.error('No auth token found');
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
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
