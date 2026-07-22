"use client";

import React from "react";
import ForkliftWebDashboard from "@/components/forklift/ForkliftWebDashboard";
import ForkliftMobileDashboard from "@/components/forklift/ForkliftMobileDashboard";

export default function ForkliftPage() {
  const isWeb = process.env.NEXT_PUBLIC_BASE_PATH === "/wms";

  if (isWeb) {
    return <ForkliftWebDashboard />;
  }

  return <ForkliftMobileDashboard />;
}
