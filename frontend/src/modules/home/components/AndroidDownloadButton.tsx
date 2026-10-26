import { Download, Loader2 } from "lucide-react";
import { useMobileAppInfo } from "../hooks/useMobileAppInfo";
import { ANDROID_DOWNLOAD_URL } from "../services/mobileAppService";
import { releaseDetails } from "../utils/releaseDetails";

const PILL = "inline-flex items-center gap-2 rounded-full px-6 py-3 font-landing text-[15px] font-semibold";

/**
 * "Download for Android": the APK link with its version, size and date. It reads
 * "coming soon" until an APK has been uploaded. If the info call fails, the link
 * is still offered, because the download itself may work.
 */
export default function AndroidDownloadButton({ align = "start" }: { align?: "start" | "center" }) {
  const { data, isLoading } = useMobileAppInfo();
  const android = data?.android;
  const alignClass = align === "center" ? "items-center" : "items-start";

  if (isLoading) {
    return (
      <span className={`${PILL} bg-[#e6e1d6] text-[#625d6e]`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking the latest version…
      </span>
    );
  }

  if (android && !android.available) {
    return <span className={`${PILL} bg-[#e6e1d6] text-[#625d6e]`}>Android app coming soon</span>;
  }

  const details = android ? releaseDetails(android) : "";

  return (
    <div className={`flex flex-col gap-2 ${alignClass}`}>
      <a
        href={ANDROID_DOWNLOAD_URL}
        download="Proctavo.apk"
        className={`${PILL} bg-[#17151f] text-white transition-transform hover:scale-[1.03]`}
      >
        <Download className="h-4 w-4" aria-hidden /> Download for Android
      </a>
      {details ? <p className="font-landing-mono text-[11px] text-[#8a8494]">{details}</p> : null}
    </div>
  );
}
