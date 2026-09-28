import { Mail, Phone } from "lucide-react";

/**
 * Reusable contact-action row: Call (tel), WhatsApp (wa.me), and optional email.
 * Used wherever a person's contact is surfaced (DCS/RS invigilator cards, etc.)
 * so every "reach this person" affordance looks and behaves the same.
 *
 * WhatsApp needs the number in international form with no "+" or spaces, so we
 * strip everything but digits. Clicks stop propagation so tapping an action
 * inside a clickable row/card never also triggers the row's onClick.
 */

// lucide-react dropped brand icons, so inline the WhatsApp glyph.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.1-.471-.149-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const digitsOnly = (phone: string) => phone.replace(/\D/g, "");

interface ContactActionsProps {
  phone?: string | null;
  email?: string | null;
  /** Show the phone number text on the Call button (off for tight layouts). */
  showNumber?: boolean;
}

export default function ContactActions({
  phone,
  email,
  showNumber = true,
}: ContactActionsProps) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {phone ? (
        <>
          <a
            href={`tel:${phone}`}
            onClick={stop}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <Phone className="h-3 w-3" />
            {showNumber ? phone : "Call"}
          </a>
          <a
            href={`https://wa.me/${digitsOnly(phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            title="Message on WhatsApp"
            className="inline-flex items-center gap-1 rounded-md bg-[#25D366] px-2 py-1 font-bold text-white shadow-sm transition-colors hover:brightness-95"
          >
            <WhatsAppIcon className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 font-semibold text-amber-700">
          <Phone className="h-3 w-3" />
          No phone on file
        </span>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={stop}
          className="inline-flex items-center gap-1 text-gray-600 hover:text-blue-600"
        >
          <Mail className="h-3 w-3" />
          {email}
        </a>
      )}
    </div>
  );
}
