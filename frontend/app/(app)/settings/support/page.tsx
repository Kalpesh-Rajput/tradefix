"use client";

import { ComingFeature, SettingsPlaceholder } from "@/components/settings/SettingsPlaceholder";

export default function SupportSettingsPage() {
  return (
    <SettingsPlaceholder title="Support" subtitle="Help, docs, and contact." cardTitle="Get help">
      <ComingFeature
        title="We're here"
        body="Reach out with product feedback or bugs. For AI agent issues, confirm your OpenRouter API key in the backend .env."
        cta="Open documentation"
        onClick={() => window.open("https://openrouter.ai/docs", "_blank")}
      />
    </SettingsPlaceholder>
  );
}
