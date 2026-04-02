'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Clock, BookOpen, AlertCircle } from 'lucide-react';

interface CandidateDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  current_role: string;
  years_experience: number;
  highest_education?: string;
  skills: string[];
  batch_name: string;
  batch_id: string;
  file_name: string;
  parsed_data?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    current_role?: string;
    years_experience?: number;
    skills?: string[];
    education?: any[];
    experience_history?: any[];
    bio?: string;
  };
}

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCandidateDetail();
  }, [params.id]);

  const fetchCandidateDetail = async () => {
    try {
      const token = localStorage.getItem('tf_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
      const response = await fetch(`${apiUrl}/api/v1/admin/unified-candidates?candidate_id=${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch candidate details');
      }

      const data = await response.json();
      const candidateData = data.candidates?.find((c: any) => c.id === params.id);
      
      if (candidateData) {
        setCandidate(candidateData);
      } else {
        setError('Candidate not found');
      }
    } catch (err) {
      console.error('Error fetching candidate:', err);
      setError(err instanceof Error ? err.message : 'Failed to load candidate details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-6">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 font-medium text-lg">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-8 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg border border-red-200 p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-bold text-red-700">Error</h2>
          </div>
          <p className="text-red-600">{error || 'Candidate not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-8 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-8 text-white">
            <h1 className="text-4xl font-bold mb-2">{candidate.name}</h1>
            <p className="text-blue-100 text-lg">{candidate.current_role || 'Not specified'}</p>
          </div>

          {/* Contact Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-8 py-8 border-b border-slate-200">
            {candidate.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</p>
                  <a href={`mailto:${candidate.email}`} className="text-slate-900 font-medium hover:text-blue-600 break-all">
                    {candidate.email}
                  </a>
                </div>
              </div>
            )}
            
            {candidate.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</p>
                  <a href={`tel:${candidate.phone}`} className="text-slate-900 font-medium hover:text-blue-600">
                    {candidate.phone}
                  </a>
                </div>
              </div>
            )}

            {candidate.location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</p>
                  <p className="text-slate-900 font-medium">{candidate.location}</p>
                </div>
              </div>
            )}

            {candidate.years_experience !== undefined && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Experience</p>
                  <p className="text-slate-900 font-medium">{candidate.years_experience} years</p>
                </div>
              </div>
            )}

            {candidate.highest_education && (
              <div className="flex items-start gap-3 md:col-span-1">
                <BookOpen className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Education</p>
                  <p className="text-slate-900 font-medium">{candidate.highest_education}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 md:col-span-1">
              <Briefcase className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch</p>
                <p className="text-slate-900 font-medium">{candidate.batch_name}</p>
              </div>
            </div>
          </div>

          {/* Skills Section */}
          {Array.isArray(candidate.skills) && candidate.skills.length > 0 && (
            <div className="px-8 py-8 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="px-8 py-8 text-slate-600 text-sm">
            <p><strong>File Name:</strong> {candidate.file_name}</p>
            <p className="mt-2"><strong>Candidate ID:</strong> {candidate.id.substring(0, 8)}...</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4 justify-end">
          <button
            onClick={() => router.push('/admin/unified-candidates')}
            className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold rounded-lg transition-all"
          >
            Back to List
          </button>
          {candidate.email && (
            <a
              href={`mailto:${candidate.email}`}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
            >
              Contact Candidate
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
