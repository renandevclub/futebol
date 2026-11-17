import type { ReactNode } from "react";
import { AuthRouteScreen } from "@/components/AuthRouteScreen";

export default function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AuthRouteScreen />
    </>
  );
}
