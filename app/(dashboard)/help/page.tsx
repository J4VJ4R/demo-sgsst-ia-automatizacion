import { getCurrentUser } from "@/app/auth-actions";
import { HelpCenter } from "@/components/help/help-center";
import { redirect } from "next/navigation";

export default async function HelpCenterPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  const userRole = user.role || "CLIENT_VIEWER";

  return (
    <div className="flex flex-col space-y-8 p-4 md:p-8 max-w-7xl mx-auto">
      <HelpCenter userRole={userRole} />
    </div>
  );
}
