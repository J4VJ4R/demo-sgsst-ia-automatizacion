import { getCurrentUser } from "@/app/auth-actions";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/overview");
}
