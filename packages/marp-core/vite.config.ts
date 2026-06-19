import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [nodePolyfills()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "MarpCore",
      fileName: () => "marpCore.js",
      formats: ["iife"],
    },
    outDir: "dist",
    minify: "terser",
    terserOptions: {
      mangle: {
        reserved: ["MarpCore"],
      },
    },
  },
});
