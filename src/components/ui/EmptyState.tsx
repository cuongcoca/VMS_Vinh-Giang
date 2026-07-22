"use client";

/**
 * UI/EmptyState — Khi list không có dữ liệu.
 *
 * Sử dụng:
 *   <EmptyState
 *     icon="inventory_2"
 *     title="Chưa có sản phẩm nào"
 *     description="Hãy thêm sản phẩm đầu tiên để bắt đầu quản lý kho."
 *     action={<Button variant="primary" icon="add" onClick={openAdd}>Thêm sản phẩm</Button>}
 *   />
 */

import React from "react";

type EmptyStateProps = {
  /** Material symbol name. Default "inbox" */
  icon?: string;
  title: string;
  description?: string;
  /** Thường là <Button> hoặc <Link> */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center px-4 ${className}`}>
      <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-2">
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-on-surface mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-on-surface-variant max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
