import Input from "@/shared/components/Input";
import type { NewCsAccount } from "../types";

export const EMPTY_CS: NewCsAccount = { name: "", email: "", phone: "", password: "" };

/** A readable starting password the superadmin shares with the new CS. */
export const generatePassword = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

export const csAccountError = (cs: NewCsAccount): string | null => {
  if (!cs.name.trim()) return "Enter the CS's name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cs.email.trim())) return "Enter a valid email for the CS";
  if ((cs.phone.match(/\d/g) || []).length < 7) return "Enter the CS's phone number";
  if (cs.password.length < 6) return "The password needs at least 6 characters";
  return null;
};

interface Props {
  value: NewCsAccount;
  onChange: (next: NewCsAccount) => void;
  idPrefix: string;
}

/** Name / email / phone / starting password for a CS account. */
export default function CsAccountFields({ value, onChange, idPrefix }: Props) {
  const set = (key: keyof NewCsAccount) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input id={`${idPrefix}-name`} label="Name" value={value.name} onChange={set("name")} autoComplete="off" />
      <Input id={`${idPrefix}-phone`} label="Phone" value={value.phone} onChange={set("phone")} inputMode="tel" autoComplete="off" />
      <div className="sm:col-span-2">
        <Input id={`${idPrefix}-email`} label="Email (their sign-in)" type="email" value={value.email} onChange={set("email")} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-password`} className="mb-1 block text-sm font-medium text-gray-700">
          Starting password
        </label>
        <div className="flex gap-2">
          <input
            id={`${idPrefix}-password`}
            value={value.password}
            onChange={set("password")}
            autoComplete="new-password"
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => onChange({ ...value, password: generatePassword() })}
            className="shrink-0 rounded border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Generate
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Share it with them — they can change it with "Forgot password".</p>
      </div>
    </div>
  );
}
