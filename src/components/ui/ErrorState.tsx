"use client";

/**
 * UI/ErrorState — Khi API fail, replace pattern `.catch(console.error)`.
 *
 * Sử dụng:
 *   <ErrorState message="Không tải được danh sách" onRetry={fetchData} />
 */

import React from "react";
import { Button } from "./Button";

type ErrorStateProps = {
  message?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  message = "Đã có lỗi xảy ra",
  description,
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center px-4 ${className}`}>
      <span className="material-symbols-outlined text-[48px] text-error/40 mb-2">error</span>
      <h3 className="text-sm font-semibold text-error mb-1">{message}</h3>
      {description && (
        <p className="text-xs text-on-surface-variant max-w-sm">{description}</p>
      )}
      {onRetry && (
        <Button variant="ghost" size="sm" icon="refresh" onClick={onRetry} className="mt-3">
          Thử lại
        </Button>
      )}
    </div>
  );
}
