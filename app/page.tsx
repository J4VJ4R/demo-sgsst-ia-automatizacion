import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/auth-actions";

export default async function Home() {
  const user = await getCurrentUser();
  
  if (user) {
    redirect("/overview");
  } else {
    redirect("/login");
  }
}
