/**
 * Admin Settings Page
 * Configure bulk upload settings, permissions, and retention policies
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminSettings {
  id: string;
  max_file_size_mb: number;
  max_batch_size_mb: number;
  duplicate_threshold_auto_merge: number;
  duplicate_threshold_review: number;
  file_retention_days: number;
  enable_virus_scan: boolean;
  enable_email_notifications: boolean;
  notification_email: string;
  supported_formats: string[];
}

interface AdminUser {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  permissions: string[];
  created_at: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'retention'>('general');

  useEffect(() => {
    fetchSettings();
    fetchAdmins();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      if (!token) {
        router.push('/login');
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
      const response = await fetch(`${apiUrl}/api/v1/admin/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      if (!token) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
      const response = await fetch(`${apiUrl}/api/v1/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch admins');
      }

      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
      setSuccess(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('tf_token') : null;
      if (!token) {
        setError('Authentication token missing');
        setSaving(false);
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
      const response = await fetch(`${apiUrl}/api/v1/admin/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-primary-light">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          </div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-700 font-bold mb-4"      
        >
          ← Back
        </button>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Settings</h1>  
        <p className="text-slate-500 font-medium mt-2">Configure data ingestion and internal permissions</p>
      </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="flex border-b">
            {['general', 'permissions', 'retention'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-4 px-6 font-medium transition ${
                  activeTab === tab
                    ? 'bg-blue-50 border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab === 'general' && '⚙️ General'}
                {tab === 'permissions' && '👥 Permissions'}
                {tab === 'retention' && '📅 Data Retention'}
              </button>
            ))}
          </div>

          {/* General Settings Tab */}
          {activeTab === 'general' && settings && (
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max File Size (MB)
                </label>
                <input
                  type="number"
                  value={settings.max_file_size_mb}
                  onChange={(e) => handleSettingChange('max_file_size_mb', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
                <p className="text-gray-600 text-xs mt-1">Maximum size for individual resume files (default: 50 MB)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Batch Size (MB)
                </label>
                <input
                  type="number"
                  value={settings.max_batch_size_mb}
                  onChange={(e) => handleSettingChange('max_batch_size_mb', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
                <p className="text-gray-600 text-xs mt-1">Maximum total size for all files in one batch (default: 500 MB)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supported Formats
                </label>
                <div className="flex flex-wrap gap-2">
                  {settings.supported_formats.map((format) => (
                    <span key={format} className="bg-blue-100 text-blue-900 px-3 py-1 rounded-full text-sm font-medium">
                      {format}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enable_virus_scan}
                    onChange={(e) => handleSettingChange('enable_virus_scan', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-gray-700">Enable Virus Scanning (ClamAV)</span>
                </label>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enable_email_notifications}
                    onChange={(e) => handleSettingChange('enable_email_notifications', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-gray-700">Enable Email Notifications</span>
                </label>
              </div>

              {settings.enable_email_notifications && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notification Email
                  </label>
                  <input
                    type="email"
                    value={settings.notification_email}
                    onChange={(e) => handleSettingChange('notification_email', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
              )}
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Administrators</h3>
                <div className="space-y-4">
                  {admins.length === 0 ? (
                    <p className="text-gray-500">No administrators configured</p>
                  ) : (
                    admins.map((admin) => (
                      <div key={admin.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">{admin.email}</p>
                            <p className="text-gray-600 text-sm">
                              Role: <span className="font-medium">{admin.role}</span>
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(admin.permissions || []).map((perm) => (
                                <span key={perm} className="bg-purple-100 text-purple-900 px-2 py-1 rounded text-xs font-medium">
                                  {perm}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button className="text-red-600 hover:text-red-700 font-medium text-sm">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Add Administrator</h3>
                <div className="flex gap-4">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                  />
                  <select className="border-2 border-slate-300 rounded-lg px-4 py-2 bg-white text-slate-900 font-medium focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200">
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                  </select>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition">
                    Add
                  </button>
                </div>
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-900 text-sm">
                  <strong>Permissions Legend:</strong>
                </p>
                <ul className="text-blue-900 text-sm mt-2 space-y-1">
                  <li>• <strong>can_bulk_upload</strong> - Can initialize and upload batches</li>
                  <li>• <strong>can_review_duplicates</strong> - Can approve/reject duplicate merges</li>
                  <li>• <strong>can_create_accounts</strong> - Can manually create candidate accounts</li>
                  <li>• <strong>can_export_data</strong> - Can export batch data and reports</li>
                </ul>
              </div>
            </div>
          )}

          {/* Retention Tab */}
          {activeTab === 'retention' && settings && (
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Retention Period (Days)
                </label>
                <input
                  type="number"
                  value={settings.file_retention_days}
                  onChange={(e) => handleSettingChange('file_retention_days', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
                <p className="text-gray-600 text-xs mt-1">
                  How long to keep original resume files before automatic deletion (default: 90 days)
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-900 font-semibold mb-2">Data Retention Policy</p>
                <ul className="text-yellow-900 text-sm space-y-2">
                  <li>• <strong>Original Files:</strong> Deleted after {settings.file_retention_days} days</li>
                  <li>• <strong>Parsed Data:</strong> Kept indefinitely in database</li>
                  <li>• <strong>Duplicate Decisions:</strong> Kept indefinitely for audit trail</li>
                  <li>• <strong>Candidate Profiles:</strong> Kept indefinitely</li>
                  <li>• <strong>Audit Logs:</strong> Kept indefinitely for compliance</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-900 font-semibold mb-2">Storage Estimate</p>
                <p className="text-blue-900 text-sm mb-2">
                  At maximum capacity ({settings.max_batch_size_mb} MB per batch):
                </p>
                <ul className="text-blue-900 text-sm space-y-1">
                  <li>• Active Storage (files): ~{settings.max_batch_size_mb} MB</li>
                  <li>• Database (parsed data): Standard storage rules apply</li>
                  <li>• Total: Estimated dynamically</li>       
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        {activeTab === 'general' && (
          <div className="flex justify-end gap-4">
            <button
              onClick={() => {
                fetchSettings();
                setSuccess(null);
              }}
              disabled={saving}
              className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              {saving ? '💾 Saving...' : '💾 Save Settings'}
            </button>
          </div>
        )}
    </div>
  );
}

