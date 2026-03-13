import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: resolve(__dirname, "src/background.ts"),
      output: {
        format: "iife",
        entryFileNames: "background.js",
        chunkFileNames: "background-[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
    target: "es2017",
    minify: true,
  },
});
