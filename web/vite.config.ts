import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The deck page's build. It is served at deck/, beside the project's page (site/), so every asset address is
// relative (`base: "./"`) and the page works under any path. public/ is not used: the voices are imported from
// src/deck/voices/, so each clip ships once, hashed.
export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // One page, one bundle: the player and Fluent UI are about half a megabyte, and splitting them buys nothing.
    chunkSizeWarningLimit: 1024,
  },
});
