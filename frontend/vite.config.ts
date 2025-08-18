import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

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
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:2727",
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
