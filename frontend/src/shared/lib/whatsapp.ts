/** Build a WhatsApp chat deep link for a phone number.
 *
 * wa.me needs the number as digits only — country code, no `+`, spaces or
 * dashes (e.g. "+91 98000 00003" → "919800000003"). */
export function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}
