import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

const base = process.env.VITE_BACKEND_ORIGIN ?? "http://localhost:2727";
const extraAllowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const allowedHosts = Array.from(
  new Set([
    "localhost",
    "127.0.0.1",
    ".ngrok-free.dev",
    ".ngrok-free.app",
    ".ngrok.app",
    ".ngrok.dev",
    ".ngrok.io",
    ...extraAllowedHosts,
  ]),
);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const analyze = mode === "analyze";

  return {
    plugins: [
      TanStackRouterVite({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    build: {
      // Let Vite and Rollup own shared-chunking so route splitting stays intact
      // without creating custom vendor cycles at startup.
      manifest: analyze,
      sourcemap: analyze,
    },
    server: {
      port: 3000,
      allowedHosts,

      proxy: {
        "/api": {
          target: base,
          changeOrigin: true,
        },
        "/session": {
          target: base,
          changeOrigin: true,
        },
        "/logout": {
          target: base,
          changeOrigin: true,
        },
        "/login": {
          target: base,
          changeOrigin: true,
        },
        "/login/char": {
          target: base,
          changeOrigin: true,
        },
        "/login/scope": {
          target: base,
          changeOrigin: true,
        },
      },
    },
    ssr: {
      noExternal: ["framer-motion", "@heroui/react"],
    },
    optimizeDeps: {
      include: ["framer-motion"],
    },
  };
});
