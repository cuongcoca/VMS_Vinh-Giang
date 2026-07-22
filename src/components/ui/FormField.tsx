"use client";

/**
 * UI/FormField — Wrapper Label + Input + Error message + Helper text.
 *
 * Sử dụng:
 *   <FormField label="Mã hàng" required helper="Nhập đúng mã in trên chứng từ">
 *     <Input placeholder="VD: 65442462" />
 *   </FormField>
 */

import React from "react";

type FormFieldProps = {
  label?: string;
  required?: boolean;
  helper?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

export function FormField({ label, required, helper, error, className = "", children }: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="label-caps text-on-surface-variant">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && (
        <span className="text-xs text-error mt-0.5 inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {error}
        </span>
      )}
      {!error && helper && (
        <span className="text-xs text-on-surface-variant/70">{helper}</span>
      )}
    </div>
  );
}
