import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p className="px-6 py-10 text-sm text-muted-foreground">Opening the desk…</p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
