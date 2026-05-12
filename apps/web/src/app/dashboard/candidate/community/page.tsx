"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import CommunityFeed from "@/components/CommunityFeed";

export default function CandidateCommunity() {
  const router = useRouter();

  useEffect(() => {
    const token = awsAuth.getToken();
    if (!token) router.replace("/login");
  }, [router]);

  return (
    <div className="h-[calc(100vh-64px)] min-h-0 bg-[#F8F9FC] overflow-hidden">
      <CommunityFeed />
    </div>
  );
}
