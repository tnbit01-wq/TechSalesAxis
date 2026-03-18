import { redirect } from "next/navigation";

export default function LegacyRecruiterDashboardRedirect() {
  redirect("/dashboard/recruiter");
}
