"use client";

import { CustomThemeStudio } from "@/components/theme/CustomThemeStudio";
import { useAppearance } from "@/components/providers/AppearanceProvider";

export function ThemeStudioRoot() {
  const { studio, closeThemeStudio } = useAppearance();
  if (!studio) return null;
  const key = studio.mode === "edit" ? studio.id : "create";
  return <CustomThemeStudio key={key} launch={studio} onClose={closeThemeStudio} />;
}
