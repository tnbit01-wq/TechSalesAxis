"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Building2,
  Camera,
  Image as ImageIcon,
  Palette,
  Plus,
  Save,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

interface CompanyBranding {
  logo_url?: string;
  brand_colors?: {
    primary: string;
    secondary: string;
  };
  life_at_photo_urls?: string[];
  name?: string;
}

export default function EmployerBrandingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function loadBranding() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const data = await apiClient.get(
          "/recruiter/profile",
          token,
        );
        setBranding({
          logo_url: data.companies?.logo_url,
          brand_colors: data.companies?.brand_colors || {
            primary: "#2563eb",
            secondary: "#64748b",
          },
          life_at_photo_urls: data.companies?.life_at_photo_urls || [],
          name: data.companies?.name,
        });
      } catch (err) {
        console.error("Failed to load branding:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBranding();
  }, [router]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "logo");

      const result = await apiClient.post("/storage/upload/branding", formData, token);
      
      setBranding((prev) => (prev ? { ...prev, logo_url: result.url } : null));
      setMessage({
        type: "success",
        text: "Logo uploaded. Remember to save changes.",
      });
    } catch (err) {
      console.error("Logo upload failed:", err);
      setMessage({ type: "error", text: "Failed to upload logo." });
    } finally {
      setUploading(false);
    }
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("Not authenticated");

      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", "life");

        const result = await apiClient.post("/storage/upload/branding", formData, token);
        newUrls.push(result.url);
      }

      setBranding((prev) =>
        prev
          ? {
              ...prev,
              life_at_photo_urls: [
                ...(prev.life_at_photo_urls || []),
                ...newUrls,
              ],
            }
          : null,
      );
      setMessage({
        type: "success",
        text: `${newUrls.length} photos added. Remember to save changes.`,
      });
    } catch (err) {
      console.error("Photos upload failed:", err);
      setMessage({ type: "error", text: "Failed to upload photos." });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => {
    setBranding((prev) =>
      prev
        ? {
            ...prev,
            life_at_photo_urls: prev.life_at_photo_urls?.filter(
              (u) => u !== url,
            ),
          }
        : null,
    );
  };

  const handleSave = async () => {
    if (!branding) return;
    setSaving(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        "/recruiter/update-branding",
        {
          logo_url: branding.logo_url,
          brand_colors: branding.brand_colors,
          life_at_photo_urls: branding.life_at_photo_urls,
        },
        token,
      );

      setMessage({
        type: "success",
        text: "Employer branding signals updated!",
      });
    } catch (err) {
      console.error("Failed to save branding:", err);
      setMessage({
        type: "error",
        text: "Failed to synchronize branding data.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Company <span className="text-indigo-600">Branding</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Customize your company identity
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/recruiter/organization/profile")}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium w-fit"
          >
            Back
          </button>
        </header>

        {/* Success/Error Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center justify-between animate-in fade-in ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Palette className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {message.text}
              </span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-sm opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}

        {/* Branding Grid */}
        <div className="grid grid-cols-12 gap-8 pb-24">
          {/* Logo Section */}
          <div className="col-span-12 lg:col-span-5 space-y-8">
            <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 mb-1">Company Logo</h2>
                <p className="text-xs text-slate-500 font-medium">Upload your company logo</p>
              </div>

              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative">
                  <div className="h-32 w-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden transition-all duration-300">
                    {branding?.logo_url ? (
                      <Image
                        src={branding.logo_url}
                        alt="Logo"
                        fill
                        className="object-contain p-4"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-slate-300">
                        <Building2 className="h-8 w-8" />
                        <span className="text-[8px] font-black uppercase tracking-widest">
                          No Logo
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-2 -right-2 h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg hover:bg-slate-800 transition-all active:scale-90 z-10"
                  >
                    {uploading ? (
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900 mb-1">Brand Colors</h2>
                <p className="text-xs text-slate-500 font-medium">Choose your primary and secondary colors</p>
              </div>

              <div className="space-y-10">
                {/* Primary Color */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">
                      Main Brand Color
                    </label>
                  </div>

                  {/* Expanded Professional Palette */}
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      "#0f172a",
                      "#334155",
                      "#475569",
                      "#4f46e5",
                      "#6366f1",
                      "#818cf8",
                      "#0891b2",
                      "#06b6d4",
                      "#22d3ee",
                      "#059669",
                      "#10b981",
                      "#34d399",
                      "#d97706",
                      "#f59e0b",
                      "#fbbf24",
                      "#dc2626",
                      "#ef4444",
                      "#f87171",
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() =>
                          setBranding((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  brand_colors: {
                                    ...prev.brand_colors!,
                                    primary: color,
                                  },
                                }
                              : null,
                          )
                        }
                        className={`h-6 w-full rounded-md transition-all ${branding?.brand_colors?.primary === color ? "ring-2 ring-indigo-600 scale-110 shadow-md" : "opacity-80 hover:opacity-100"}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  {/* Fully Unlimited Picker */}
                  <div className="relative group cursor-pointer h-16 rounded-[1.25rem] border border-slate-100 shadow-sm overflow-hidden bg-white hover:border-indigo-200 transition-all">
                    {/* Visual spectrum hint */}
                    <div className="absolute inset-0 opacity-[0.03] bg-linear-to-r from-red-500 via-green-500 to-blue-500 pointer-events-none" />

                    <div className="absolute inset-0 flex items-center px-4 gap-4">
                      <div
                        className="h-10 w-10 rounded-xl border-2 border-white shadow-xl ring-1 ring-slate-100 shrink-0"
                        style={{
                          backgroundColor: branding?.brand_colors?.primary,
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-900 uppercase tracking-tighter">
                          Unlimited Color Selection
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">
                          Click here to open precise picker
                        </span>
                      </div>
                    </div>

                    <input
                      type="color"
                      value={branding?.brand_colors?.primary || "#4f46e5"}
                      onChange={(e) =>
                        setBranding((prev) =>
                          prev
                            ? {
                                ...prev,
                                brand_colors: {
                                  ...prev.brand_colors!,
                                  primary: e.target.value,
                                },
                              }
                            : null,
                        )
                      }
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Support Color
                    </label>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {[
                      "#1e293b",
                      "#475569",
                      "#64748b",
                      "#312e81",
                      "#4338ca",
                      "#4f46e5",
                      "#155e75",
                      "#0e7490",
                      "#0891b2",
                      "#134e4a",
                      "#0f766e",
                      "#0d9488",
                      "#7c2d12",
                      "#9a3412",
                      "#c2410c",
                      "#7f1d1d",
                      "#991b1b",
                      "#b91c1c",
                    ].map((color) => (
                      <button
                        key={color}
                        onClick={() =>
                          setBranding((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  brand_colors: {
                                    ...prev.brand_colors!,
                                    secondary: color,
                                  },
                                }
                              : null,
                          )
                        }
                        className={`h-6 w-full rounded-md transition-all ${branding?.brand_colors?.secondary === color ? "ring-2 ring-slate-900 scale-110 shadow-md" : "opacity-80 hover:opacity-100"}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>

                  <div className="relative group cursor-pointer h-16 rounded-[1.25rem] border border-slate-100 shadow-sm overflow-hidden bg-white hover:border-slate-200 transition-all">
                    <div className="absolute inset-0 opacity-[0.03] bg-linear-to-r from-red-500 via-green-500 to-blue-500 pointer-events-none" />

                    <div className="absolute inset-0 flex items-center px-4 gap-4">
                      <div
                        className="h-10 w-10 rounded-xl border-2 border-white shadow-xl ring-1 ring-slate-100 shrink-0"
                        style={{
                          backgroundColor: branding?.brand_colors?.secondary,
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-900 uppercase tracking-tighter">
                          Unlimited Color Selection
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">
                          Click here to open precise picker
                        </span>
                      </div>
                    </div>

                    <input
                      type="color"
                      value={branding?.brand_colors?.secondary || "#64748b"}
                      onChange={(e) =>
                        setBranding((prev) =>
                          prev
                            ? {
                                ...prev,
                                brand_colors: {
                                  ...prev.brand_colors!,
                                  secondary: e.target.value,
                                },
                              }
                            : null,
                        )
                      }
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Photos Section */}
          <div className="col-span-12 lg:col-span-7">
            <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Culture Photos</h2>
                  <p className="text-xs text-slate-500 font-medium">Showcase your company culture</p>
                </div>
                <button
                  onClick={() => photosInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
                <input
                  type="file"
                  ref={photosInputRef}
                  onChange={handlePhotosUpload}
                  className="hidden"
                  multiple
                  accept="image/*"
                />
              </div>

              {branding?.life_at_photo_urls &&
              branding.life_at_photo_urls.length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
                  {branding.life_at_photo_urls.map((url, i) => (
                    <div
                      key={i}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shadow-sm"
                    >
                      <Image
                        src={url}
                        alt="Culture"
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button
                          onClick={() => removePhoto(url)}
                          className="h-10 w-10 bg-white text-rose-600 rounded-xl flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all transform translate-y-4 group-hover:translate-y-0 duration-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-200 border-2 border-dashed border-slate-50 rounded-4xl">
                  <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]">
                    No Photos
                  </p>
                  <p className="text-[9px] font-medium text-slate-400 mt-2">
                    Upload team photos to attract candidates
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Save Button - Fixed Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-center z-20">
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-200"
        >
          {saving ? (
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </footer>
    </div>
  );
}
