import { Suspense } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { configured } from "@/lib/supabase";
export default function Login() {
  return (
    <Suspense>
      <AuthScreen configured={configured()} />
    </Suspense>
  );
}
