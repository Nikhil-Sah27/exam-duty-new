import { Download } from "lucide-react";

type Variant = "primary" | "subtle" | "ghost" | "indigo" | "sky";

const STYLES: Record<Variant, string> = {
  primary: "bg-gray-800 text-white hover:bg-gray-700",
  subtle: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
  ghost: "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
  indigo: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500",
  sky: "bg-sky-600 text-white shadow-sm hover:bg-sky-500",
};

/**
 * One export button, a few visual weights — used at the exam (primary), day
 * (indigo), and shift (sky) levels so the roster's export affordances read as a
 * clear, color-coded hierarchy instead of three identical buttons.
 */
export default function ExportButton({
  label,
  onClick,
  variant = "subtle",
}: {
  label: string;
  onClick: () => void;
  variant?: Variant;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${STYLES[variant]}`}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
