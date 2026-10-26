import { formatDate } from "@/shared/lib/utils";
import type { AndroidRelease } from "../types";

/** "v1.0.0 · 109 MB · updated 23 Oct 2026". Skips whatever the server didn't report. */
export function releaseDetails(release: AndroidRelease): string {
  const parts: string[] = [];
  if (release.version) parts.push(`v${release.version}`);
  if (release.sizeBytes) parts.push(`${Math.max(1, Math.round(release.sizeBytes / (1024 * 1024)))} MB`);
  if (release.updatedAt) parts.push(`updated ${formatDate(release.updatedAt)}`);
  return parts.join(" · ");
}
