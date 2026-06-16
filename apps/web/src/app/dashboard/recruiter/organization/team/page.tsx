"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";

export default function TeamRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/recruiter/account/settings?tab=team");
  }, [router]);

  return <LoadingScreen label="Redirecting to settings..." />;
}
