"use client";

/**
 * UI/Textarea — Multi-line input chuẩn.
 */

import React from "react";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

export function Textarea({ error, className = "", rows = 3, ...rest }: TextareaProps) {
  const errorClass = error
    ? "border-error focus:border-error focus:ring-error/30"
    : "border-outline-variant focus:border-primary focus:ring-primary/20";
  return (
    <textarea
      rows={rows}
      className={`w-full bg-white px-3 py-2 text-sm rounded-lg border ${errorClass} focus:outline-none focus:ring-2 transition-colors disabled:bg-surface-low disabled:cursor-not-allowed resize-y ${className}`}
      {...rest}
    />
  );
}
