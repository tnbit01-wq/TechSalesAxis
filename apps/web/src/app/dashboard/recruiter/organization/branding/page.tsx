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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] p-8">
      <div className="max-w-6xl mx-auto pb-24">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Company <span className="text-indigo-600 italic">Style</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Logo, Colors and Culture Photos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white border border-slate-100 rounded-lg flex flex-col items-center justify-center shadow-sm">
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">
                Profile Info
              </span>
              <span className="text-xs font-black text-slate-900 italic uppercase leading-none">
                {branding?.logo_url ? "Ready" : "Incomplete"}
              </span>
            </div>
            <button
              onClick={() =>
                router.push("/dashboard/recruiter/organization/profile")
              }
              className="h-10 px-4 bg-slate-50 text-slate-600 border border-slate-100 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all active:scale-95"
            >
              Go Back
            </button>
          </div>
        </header>

        {message && (
          <div
            className={`mb-8 p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4 ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-red-50 text-red-700 border border-red-100"
            }`}
          >
            <div className="flex items-center gap-3">
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Palette className="h-4 w-4" />
              )}
              <span className="font-black text-[10px] uppercase tracking-wider">
                {message.text}
              </span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-[10px] font-black uppercase opacity-50 hover:opacity-100"
            >
              Close
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-8">
          {/* Left Column: Visual Assets */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            {/* Logo Section */}
            <section className="bg-white p-6 rounded-4xl border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/30 rounded-bl-full -mr-12 -mt-12 pointer-events-none" />

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  Your Logo
                </h3>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative inline-block">
                  <div className="h-32 w-32 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-[1.02] transition-transform duration-500">
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

            {/* Colors Section */}
            <section className="bg-white p-6 rounded-4xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                  Company Colors
                </h3>
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

          {/* Right Column: Life at Company Photos */}
          <div className="col-span-12 lg:col-span-8">
            <section className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                <div>
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1 italic">
                    Culture Photos
                  </h3>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none mt-1">
                    Show life at {branding?.name || "the office"}
                  </p>
                </div>
                <button
                  onClick={() => photosInputRef.current?.click()}
                  disabled={uploading}
                  className="px-5 h-9 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Photo
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
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 flex justify-center z-20">
        <div className="max-w-6xl w-full flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-8 h-10 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:bg-blue-600 transition-all active:scale-95 group"
          >
            {saving ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save All Changes
          </button>
        </div>
      </footer>
    </div>
  );
}
