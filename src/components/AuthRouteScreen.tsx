"use client";

import { usePathname, useRouter } from "next/navigation";
import { AuthScreen } from "@/components/AuthScreen";

export function AuthRouteScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const initialMode = pathname === "/cadastro" ? "register" : "login";

  return (
    <AuthScreen
      isOpen
      standalone
      initialMode={initialMode}
      onClose={() => router.replace("/")}
      onModeChange={(mode) => router.push(mode === "login" ? "/login" : "/cadastro")}
    />
  );
}
