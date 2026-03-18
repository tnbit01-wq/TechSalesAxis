import { redirect } from "next/navigation";

export default function LegacyCandidateDashboardRedirect() {
  redirect("/dashboard/candidate");
}
