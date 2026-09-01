import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  base: "./",
  plugins: [react(), tailwindcss()],
  publicDir: "public",
  build: {
    outDir: "../assets/design",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: "src/main.tsx",
      formats: ["es"],
      fileName: "design-library",
      cssFileName: "design-library",
    },
    rollupOptions: {
      output: {
        entryFileNames: "design-library.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith(".css") ? "design-library.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
