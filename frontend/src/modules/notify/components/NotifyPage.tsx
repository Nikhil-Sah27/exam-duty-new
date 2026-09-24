import { useMemo, useState } from "react";
import { CheckCircle2, Megaphone } from "lucide-react";
import type { UserRole } from "@/shared/lib/types";
import { useSendBroadcast } from "../hooks";
import type { NotifyAudience, SendBroadcastRequest } from "../types";
import AudienceSelector from "./AudienceSelector";
import RoleMultiSelect from "./RoleMultiSelect";
import TeacherMultiSelect from "./TeacherMultiSelect";
import NotifyComposer from "./NotifyComposer";

export default function NotifyPage() {
  const [audience, setAudience] = useState<NotifyAudience>("all");
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [lastSentCount, setLastSentCount] = useState<number | null>(null);

  const sendMutation = useSendBroadcast();

  const disabledReason = useMemo<string | null>(() => {
    if (audience === "role" && selectedRoles.length === 0) {
      return "Pick at least one role.";
    }
    if (audience === "specific" && selectedIds.length === 0) {
      return "Pick at least one teacher.";
    }
    return null;
  }, [audience, selectedRoles.length, selectedIds.length]);

  const canSubmit =
    !disabledReason && title.trim().length > 0 && message.trim().length > 0;

  const handleSubmit = () => {
    const payload: SendBroadcastRequest = {
      audience,
      title: title.trim(),
      message: message.trim(),
      ...(audience === "role" ? { roles: selectedRoles } : {}),
      ...(audience === "specific" ? { userIds: selectedIds } : {}),
    };

    sendMutation.mutate(payload, {
      onSuccess: (res) => {
        setLastSentCount(res.sent);
        setTitle("");
        setMessage("");
        if (audience === "specific") setSelectedIds([]);
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notify</h1>
          <p className="mt-1 text-sm text-gray-500">
            Send an in-app notification to all teachers, a role group, or specific individuals.
          </p>
        </div>
      </header>

      {lastSentCount !== null && !sendMutation.isPending && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>
            {lastSentCount === 0
              ? "No matching recipients — nothing was sent."
              : `Notification delivered to ${lastSentCount} recipient${lastSentCount === 1 ? "" : "s"}.`}
          </span>
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          1. Choose audience
        </h2>
        <AudienceSelector value={audience} onChange={setAudience} />

        {audience === "role" && (
          <div className="pt-2">
            <RoleMultiSelect
              selected={selectedRoles}
              onChange={setSelectedRoles}
            />
          </div>
        )}

        {audience === "specific" && (
          <div className="pt-2">
            <TeacherMultiSelect
              selectedIds={selectedIds}
              onChange={setSelectedIds}
            />
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          2. Compose message
        </h2>
        <NotifyComposer
          title={title}
          message={message}
          onTitleChange={setTitle}
          onMessageChange={setMessage}
          onSubmit={handleSubmit}
          canSubmit={canSubmit}
          isSending={sendMutation.isPending}
          errorMessage={
            sendMutation.isError ? sendMutation.error.message : null
          }
          disabledReason={disabledReason}
        />
      </section>
    </div>
  );
}
