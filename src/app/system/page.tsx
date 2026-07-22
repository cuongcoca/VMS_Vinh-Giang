"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SystemIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/system/users");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>
    </div>
  );
}
