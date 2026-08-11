import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupChats } from "../GroupChats";
import { EmptyState } from "../EmptyState";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "11111111-1111-4111-8111-111111111111" }, session: null, loading: false }),
}));

vi.mock("@/hooks/use-equipped-cosmetics", () => ({
  useEquippedCosmetics: () => ({}),
}));

const chain = () => {
  const c: Record<string, unknown> = {};
  const self = () => c;
  Object.assign(c, {
    select: self,
    eq: self,
    in: self,
    or: self,
    order: self,
    limit: self,
    maybeSingle: async () => ({ data: null, error: null }),
    then: (res: (v: { data: never[]; error: null }) => unknown) => res({ data: [], error: null }),
  });
  return c;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => chain()),
    rpc: vi.fn(async () => ({ data: [], error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } })) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
  },
}));

describe("social surfaces", () => {
  it("group chats settle into an empty state with a create CTA (never an endless spinner)", async () => {
    render(<GroupChats />);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull());
    expect(await screen.findByText(/no group chats yet/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /create a group/i })).toBeTruthy();
  });

  it("empty states always render an action button", () => {
    render(
      <EmptyState
        title="No players yet"
        body="Add someone"
        action={<button type="button">ADD FRIEND</button>}
      />,
    );
    expect(screen.getByRole("button", { name: /add friend/i })).toBeTruthy();
  });
});
