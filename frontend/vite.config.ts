import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

const base = process.env.VITE_BACKEND_ORIGIN ?? "http://localhost:2727";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "react-vendor";
          }

          if (id.includes("node_modules/@tanstack/")) {
            return "tanstack-vendor";
          }

          if (id.includes("node_modules/@heroui/")) {
            return "heroui-vendor";
          }

          if (
            id.includes("node_modules/framer-motion/") ||
            id.includes("node_modules/motion-")
          ) {
            return "motion-vendor";
          }

          if (
            id.includes("node_modules/@react-aria/") ||
            id.includes("node_modules/@react-stately/") ||
            id.includes("node_modules/@react-types/") ||
            id.includes("node_modules/@internationalized/")
          ) {
            return "react-aria-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    port: 3000,

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
    },
  },
  ssr: {
    noExternal: ["framer-motion", "@heroui/react"],
  },
  optimizeDeps: {
    include: ["framer-motion"],
  },
});
