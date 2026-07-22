import React from "react";

export function Badge({
  children,
  variant = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "success" | "warning" | "error" | "info" | "neutral" | "purple";
  className?: string;
}) {
  return (
    <span className={`chip chip-${variant} ${className}`}>{children}</span>
  );
}
