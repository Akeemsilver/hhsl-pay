import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves a project site under /<repo>/. Set BASE_PATH=/ when moving to a custom domain.
const base = process.env.BASE_PATH || "/hhsl-salary-tracker/";

// Shown in Settings so you can tell which version is running.
const buildId = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${(process.env.GITHUB_SHA || "local").slice(0, 7)}`;

export default defineConfig(({ command }) => ({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  base: command === "build" ? base : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      workbox: { clientsClaim: true },
      manifest: {
        name: "HHSL Salary Tracker",
        short_name: "Salary",
        description: "Track shifts, pay and tax. Your data stays on this device.",
        theme_color: "#0f766e",
        background_color: "#f6f7f9",
        display: "standalone",
        orientation: "portrait",
        start_url: base,
        scope: base,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: { include: ["tests/**/*.test.ts"] },
}));
