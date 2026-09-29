import { useNavigate } from "react-router-dom";
import { Phone } from "lucide-react";
import { formatDate } from "@/shared/lib/utils";
import RoleBadge from "@/shared/components/RoleBadge";
import { UserProfile } from "../types";
import TeacherRowActions from "./TeacherRowActions";

interface TeacherRowProps {
  user: UserProfile;
}

export default function TeacherRow({ user }: TeacherRowProps) {
  const navigate = useNavigate();

  const handleRowClick = () => {
    navigate(`/manage-duties/${user._id}`);
  };

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const rowTone = user.isActive
    ? "hover:bg-gray-50/80"
    : "bg-gray-50/60 text-gray-500 hover:bg-gray-100/80";

  return (
    <tr
      onClick={handleRowClick}
      className={`cursor-pointer border-b border-gray-50 transition-colors last:border-b-0 ${rowTone}`}
    >
      {/* Teacher (avatar + name + email) */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
              user.isActive ? "bg-gray-800" : "bg-gray-400"
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-semibold ${
                user.isActive ? "text-gray-900" : "text-gray-500"
              }`}
            >
              {user.name}
            </p>
            <p className="truncate text-xs text-gray-400">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Contact — phone prominent (CS/DCS need to reach the teacher) */}
      <td className="px-5 py-3">
        {user.phone ? (
          <a
            href={`tel:${user.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-blue-600"
          >
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            {user.phone}
          </a>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Roles — one badge per assigned role */}
      <td className="px-5 py-3">
        <div className="flex flex-wrap gap-1">
          {(user.roles || []).map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>
      </td>

      {/* Department */}
      <td className="px-5 py-3 text-sm text-gray-600">
        {user.department || <span className="text-gray-300">—</span>}
      </td>

      {/* Designation */}
      <td className="px-5 py-3 text-sm text-gray-600">
        {user.designation || <span className="text-gray-300">—</span>}
      </td>

      {/* Added date */}
      <td className="px-5 py-3 text-xs text-gray-400">
        {formatDate(user.createdAt)}
      </td>

      {/* Actions */}
      <td className="px-5 py-3">
        <TeacherRowActions user={user} />
      </td>
    </tr>
  );
}
