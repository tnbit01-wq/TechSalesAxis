import { redirect } from "next/navigation";

export default function LegacyCandidateOnboardingRedirect() {
  redirect("/onboarding/candidate");
}
