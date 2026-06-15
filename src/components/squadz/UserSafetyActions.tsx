import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { blockUser, reportTarget } from "@/lib/blocks";
import { toast } from "sonner";

type Props = {
  targetId: string | null | undefined;
  targetLabel?: string | null;
  onBlocked?: () => void;
};

export function UserSafetyActions({ targetId, targetLabel, onBlocked }: Props) {
  const { user } = useAuth();
  if (!user || !targetId || targetId === user.id) return null;

  const label = targetLabel || "this user";

  async function report() {
    if (!user || !targetId) return;
    const reason = window.prompt(`Report ${label}`, "Harassment or abuse");
    if (!reason?.trim()) return;
    const { error } = await reportTarget({
      reporter_id: user.id,
      target_type: "profile",
      target_id: targetId,
      reason,
    });
    if (error) return toast.error(error.message);
    toast.success("Report sent");
  }

  async function block() {
    if (!user || !targetId) return;
    const { error } = await blockUser(user.id, targetId);
    if (error) return toast.error(error.message);
    toast.success(`${label} blocked`);
    onBlocked?.();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="User actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={report}>
          <Flag className="h-4 w-4" /> Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={block} className="text-destructive focus:text-destructive">
          <Ban className="h-4 w-4" /> Block
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}