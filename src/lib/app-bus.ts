/** Tiny cross-tab event bus so Find/Community can hand off to the Chat tab. */
type OpenChatDetail = { conversationId?: string; groupId?: string };
type SwitchTabDetail = { tab: "find" | "clans" | "chat" | "community" | "profile" };

export function openChat(detail: OpenChatDetail) {
  window.dispatchEvent(new CustomEvent("rostr:open-chat", { detail }));
}
export function onOpenChat(cb: (d: OpenChatDetail) => void) {
  const h = (e: Event) => cb((e as CustomEvent).detail as OpenChatDetail);
  window.addEventListener("rostr:open-chat", h);
  return () => window.removeEventListener("rostr:open-chat", h);
}

export function switchTab(tab: SwitchTabDetail["tab"]) {
  window.dispatchEvent(new CustomEvent("rostr:switch-tab", { detail: { tab } }));
}
export function onSwitchTab(cb: (d: SwitchTabDetail) => void) {
  const h = (e: Event) => cb((e as CustomEvent).detail as SwitchTabDetail);
  window.addEventListener("rostr:switch-tab", h);
  return () => window.removeEventListener("rostr:switch-tab", h);
}
