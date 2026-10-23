import { Suspense } from "react";
import { AuthScreen } from "@/components/auth-screen";
import { configured } from "@/lib/supabase";
export default function Reset() {
  return (
    <Suspense>
      <AuthScreen configured={configured()} reset />
    </Suspense>
  );
}
