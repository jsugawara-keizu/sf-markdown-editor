import path from "path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [nodePolyfills({ exclude: ["fs"] })],
  resolve: {
    alias: {
      // Marp uses fs.existsSync at import time; stub it for browser/VF context.
      fs: path.resolve(__dirname, "src/fs-stub.ts"),
    },
  },
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
