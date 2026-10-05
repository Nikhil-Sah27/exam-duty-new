import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  Loader2,
  Mail,
  Phone,
  type LucideIcon,
} from "lucide-react";
import Modal from "@/shared/components/Modal";
import { WhatsAppIcon } from "@/shared/components";
import { waLink } from "@/shared/lib/whatsapp";
import { fetchUserById } from "@/modules/users/services";
import { ROLE_LABELS } from "@/shared/constants/roles";
import { initials } from "../utils/format";

interface TeacherProfileModalProps {
  teacherId: string | null;
  open: boolean;
  onClose: () => void;
  fallbackName?: string;
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-1 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <div className="text-sm text-gray-800">{children}</div>
      </div>
    </div>
  );
}

/** CS-only: shows a teacher's contact & role details from the chat header. */
export default function TeacherProfileModal({
  teacherId,
  open,
  onClose,
  fallbackName,
}: TeacherProfileModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["users", teacherId],
    queryFn: () => fetchUserById(teacherId as string),
    enabled: open && Boolean(teacherId),
  });

  const name = data?.name ?? fallbackName ?? "Teacher";
  const roles = (data?.roles ?? []).filter((r) => r !== "cs");

  return (
    <Modal open={open} onClose={onClose} title="Teacher details">
      {isLoading && !data ? (
        <div className="flex items-center justify-center py-10 text-sm text-gray-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div>
          <div className="flex flex-col items-center gap-3 border-b border-gray-100 pb-5 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-md">
              {initials(name)}
            </span>
            <div>
              <p className="text-lg font-bold text-gray-800">{name}</p>
              {roles.length > 0 && (
                <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700"
                    >
                      {ROLE_LABELS[r] ?? r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100 pt-2">
            {data?.designation && (
              <Row icon={Briefcase} label="Designation">
                {data.designation}
              </Row>
            )}
            {data?.department && (
              <Row icon={Building2} label="Department">
                {data.department}
              </Row>
            )}
            {data?.email && (
              <Row icon={Mail} label="Email">
                <a
                  href={`mailto:${data.email}`}
                  className="text-indigo-600 hover:underline"
                >
                  {data.email}
                </a>
              </Row>
            )}
            <Row icon={Phone} label="Phone">
              {data?.phone ? (
                <a
                  href={`tel:${data.phone}`}
                  className="text-indigo-600 hover:underline"
                >
                  {data.phone}
                </a>
              ) : (
                <span className="text-gray-400">Not provided</span>
              )}
            </Row>
          </div>

          {data?.phone && (
            <a
              href={waLink(data.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-600"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Chat on WhatsApp
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}
