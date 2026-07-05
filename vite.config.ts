// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import mkcert from "vite-plugin-mkcert";

// Enable local HTTPS in dev via a locally-trusted mkcert certificate. This is a
// no-op in production builds. HTTPS is required for WebRTC (camera/mic) and
// realistic Stripe/webhook testing. Skipped inside the Lovable sandbox
// (LOVABLE_SANDBOX is set) so the platform's own dev server keeps working.
const enableMkcert = !process.env.LOVABLE_SANDBOX && !process.env.CI;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: enableMkcert
    ? {
        plugins: [mkcert()],
        server: { https: true },
      }
    : undefined,
});
