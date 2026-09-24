import { FormEvent } from "react";
import { Send } from "lucide-react";
import { Input, Button, ErrorAlert } from "@/shared/components";

interface NotifyComposerProps {
  title: string;
  message: string;
  onTitleChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  isSending: boolean;
  errorMessage?: string | null;
  disabledReason?: string | null;
}

export default function NotifyComposer({
  title,
  message,
  onTitleChange,
  onMessageChange,
  onSubmit,
  canSubmit,
  isSending,
  errorMessage,
  disabledReason,
}: NotifyComposerProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && <ErrorAlert message={errorMessage} />}

      <Input
        label="Title"
        type="text"
        required
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="e.g. Exam schedule reminder"
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Message
        </label>
        <textarea
          required
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={5}
          placeholder="Write the announcement teachers will see in their notifications..."
          className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-gray-500">
          {disabledReason || "Recipients will receive an in-app notification instantly."}
        </p>
        <Button
          type="submit"
          isLoading={isSending}
          disabled={!canSubmit || isSending}
        >
          <span className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Send Notification
          </span>
        </Button>
      </div>
    </form>
  );
}
