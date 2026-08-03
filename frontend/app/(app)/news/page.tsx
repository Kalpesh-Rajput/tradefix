"use client";

import { FeaturePage } from "@/components/ui/FeaturePage";

export default function NewsPage() {
  return (
    <FeaturePage title="News" subtitle="Market headlines to frame your session.">
      <ul className="space-y-3">
        {[
          "Broad market advance — major indices tracking higher.",
          "VIX remains contained — risk appetite steady.",
          "Watch earnings and macro prints around your session window.",
        ].map((item) => (
          <li key={item} className="border-b border-white/[0.06] pb-3 last:border-0">
            {item}
          </li>
        ))}
      </ul>
    </FeaturePage>
  );
}
