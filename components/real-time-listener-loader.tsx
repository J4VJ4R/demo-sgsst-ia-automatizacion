"use client";

import dynamic from "next/dynamic";

const RealTimeListener = dynamic(
  () => import("./real-time-listener").then((mod) => mod.RealTimeListener),
  {
    ssr: false,
  }
);

export function RealTimeListenerLoader() {
  return <RealTimeListener />;
}
