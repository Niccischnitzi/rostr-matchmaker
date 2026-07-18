import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportDialog } from "../ReportDialog";
import { UserAvatar } from "../UserAvatar";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "self", email: "self@rostr.test" } }),
}));

vi.mock("@/hooks/use-equipped-cosmetics", () => ({
  useEquippedCosmetics: () => ({
    halo: { css_class: "halo-self" },
    avatar_frame: { css_class: "frame-self" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: [{ halo_class: "halo-public", frame_class: "frame-public", tag_name: "Clutch" }], error: null })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: { avatar_url: null }, error: null })),
      insert: vi.fn(async () => ({ error: null })),
    })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "self" } } })) },
    storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })) })) },
  },
}));

describe("Batch C UI surfaces", () => {
  it("applies public equipped cosmetics to other users' avatars", async () => {
    const { container } = render(<UserAvatar userId="other" avatarUrl="https://example.test/a.png" fallback="OP" />);

    expect(container.querySelector('img[src="https://example.test/a.png"]')).not.toBeNull();
    await waitFor(() => expect(container.querySelector(".halo-public")).not.toBeNull());
    expect(container.querySelector(".frame-public")).not.toBeNull();
  });

  it("renders the voice snippet report dialog copy", () => {
    render(
      <ReportDialog
        open
        onOpenChange={() => {}}
        targetType="voice_snippet"
        targetId="player-1"
        targetLabel="Player voice intro"
      />,
    );

    expect(screen.getByRole("heading", { name: /report/i })).toBeTruthy();
    expect(screen.getByText(/Player voice intro/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /submit report/i })).toHaveProperty("disabled", true);
  });
});