import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves a project site under /<repo>/. Set BASE_PATH=/ when moving to a custom domain.
const base = process.env.BASE_PATH || "/hhsl-salary-tracker/";

// Shown in Settings so you can tell which version is running.
const now = new Date().toISOString();
const buildId = `${Number(now.slice(8, 10))}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(now.slice(5, 7)) - 1]}-${now.slice(0, 4)} ${now.slice(11, 16)} UTC · ${(process.env.GITHUB_SHA || "local").slice(0, 7)}`;

export default defineConfig(({ command }) => ({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  base: command === "build" ? base : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      workbox: {
        clientsClaim: true,
        // Takes a spreadsheet shared to the app (Android Share menu), see public/share-target-sw.js.
        importScripts: ["share-target-sw.js"],
        // The guide is kept on the phone the first time it is opened and used from there until the app updates; it is never fetched on its own.
        runtimeCaching: [{ urlPattern: /\.pdf(\?.*)?$/, handler: "CacheFirst", options: { cacheName: "guide", expiration: { maxEntries: 1 }, cacheableResponse: { statuses: [200] } } }],
      },
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
        // Lets Google Sheets, Drive or Files "Share" a spreadsheet straight to this app (Android).
        share_target: {
          action: `${base}share-target`,
          method: "POST",
          enctype: "multipart/form-data",
          params: { files: [{ name: "file", accept: [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"] }] },
        },
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
