"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const PUBLIC_PATHS = new Set(["/login", "/cadastro"]);

export function AuthRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isPublicPath = PUBLIC_PATHS.has(pathname ?? "");

  useEffect(() => {
    if (isLoading) return;
    if (user && isPublicPath) router.replace("/");
    if (!user && !isPublicPath) router.replace("/login");
  }, [isLoading, isPublicPath, router, user]);

  if ((isLoading && !isPublicPath) || (user && isPublicPath) || (!user && !isPublicPath)) {
    return (
      <div className="auth-route-loading" role="status" aria-label="Carregando acesso">
        <span className="auth-route-loading__mark" aria-hidden="true" />
      </div>
    );
  }

  return children;
}
