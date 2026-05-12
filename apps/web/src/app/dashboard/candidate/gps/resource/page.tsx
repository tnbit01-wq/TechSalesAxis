"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

export default function CareerGpsResourcePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const resource = useMemo(() => {
    const title = searchParams.get("title") || "Learning Resource";
    const platform = searchParams.get("platform") || "Learning Platform";
    const url = searchParams.get("url") || "/dashboard/candidate/gps";
    const milestone = searchParams.get("milestone") || "Career GPS";

    return { title, platform, url, milestone };
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_42%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] text-slate-900">
      <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[1100px] items-center px-4 py-4">
        <div className="w-full overflow-hidden rounded-[30px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
          <div className="flex items-center justify-between border-b border-orange-100/70 bg-gradient-to-r from-[#FFF6ED] to-white px-5 py-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF8A00]">Career GPS Resource</span>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.1fr_360px]">
            <section className="p-6 md:p-8 lg:p-10">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#FFF6ED] text-[#FF8A00] ring-1 ring-orange-100">
                  <BookOpen className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#C96B00]">Learning view</p>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-4xl">{resource.title}</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    {resource.platform} • {resource.milestone}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">What this helps with</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    Use this resource to fill the next skill gap in your roadmap without leaving the experience cluttered or technical.
                  </p>
                </div>
                <div className="rounded-[24px] border border-orange-100 bg-[#FFF8F1] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C96B00]">Clean click path</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    Open the resource, then return to your roadmap or jump straight to matching jobs.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#FF8A00] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#E67A00]"
                >
                  Open resource
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Link
                  href="/dashboard/candidate/gps"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                >
                  <Sparkles className="h-4 w-4" />
                  Back to roadmap
                </Link>
                <Link
                  href="/dashboard/candidate/jobs"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                >
                  Matching jobs
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            <aside className="border-t border-orange-100/70 bg-[#FFFDF9] p-6 md:p-8 lg:border-l lg:border-t-0">
              <div className="rounded-[24px] border border-orange-100 bg-white p-5 shadow-[0_4px_16px_rgba(255,138,0,0.06)]">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Resource summary</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Title</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{resource.title}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Platform</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{resource.platform}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Milestone</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{resource.milestone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Focus</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">Finish this step, then return to your roadmap to continue the next milestone.</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Quick next steps</p>
                <div className="mt-4 space-y-2">
                  <Link href="/dashboard/candidate/gps" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]">
                    Return to roadmap
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link href="/dashboard/candidate/profile" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]">
                    Update profile
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link href="/dashboard/candidate/applications" className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]">
                    Review applications
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
