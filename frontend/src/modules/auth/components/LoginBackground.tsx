import loginBg from "@/assets/login-bg.png";

/**
 * Decorative login backdrop: the brand photograph softened by layered blue
 * scrims so the vivid image reads as a muted, professional backdrop and never
 * competes with the foreground text. Contrast is strongest across the left half
 * (brand heading + feature cards sit directly on the photo) and eases toward the
 * right, where the glass sign-in card supplies its own contrast. Purely
 * presentational + aria-hidden.
 */
export default function LoginBackground() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Photographic backdrop. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${loginBg})` }}
      />
      {/* Left-heavy scrim — keeps the brand copy fully legible on the left,
          easing off toward the sign-in card on the right. */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-950/88 via-blue-950/62 to-blue-900/38" />
      {/* Gentle uniform mute so the busiest parts of the photo never crowd the
          text, while the image stays visible underneath. */}
      <div className="absolute inset-0 bg-blue-950/25" />
      {/* Soft top + bottom depth. */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-transparent to-indigo-950/45" />
    </div>
  );
}
