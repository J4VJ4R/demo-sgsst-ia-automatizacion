import { getCurrentUser } from "@/app/auth-actions";
import { redirect } from "next/navigation";

export default async function DocumentsLayout(props: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect("/learning");
  return props.children;
}

