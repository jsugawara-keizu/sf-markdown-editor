import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';

// LWS (Lightning Web Security) sandboxes each component's window proxy.
// `var MarkdownCore = ...` at script top-level becomes a local variable inside
// the LWS wrapper, so `window.MarkdownCore` is undefined in the component.
// This plugin appends an explicit window assignment to fix that.
const lwsGlobalExport: Plugin = {
  name: 'lws-global-export',
  generateBundle(_options, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === 'chunk') {
        chunk.code += '\nwindow.MarkdownCore=MarkdownCore;';
      }
    }
  },
};

export default defineConfig({
  plugins: [lwsGlobalExport],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MarkdownCore',
      // Vite names iife output as [name].iife.js
      fileName: () => 'markdown-core.iife.js',
      formats: ['iife'],
    },
    rollupOptions: {
      // Bundle ALL dependencies into the IIFE.
      // No externals — this runs as a Salesforce Static Resource
      // and must be fully self-contained.
      external: [],
    },
    // Output directly into the static resource folder so `sf project deploy`
    // picks it up automatically.
    outDir: resolve(
      __dirname,
      '../../force-app/main/default/staticresources/markdownCore'
    ),
    // Do not wipe the folder — other static resource files may coexist.
    emptyOutDir: false,
    sourcemap: false,
    minify: true,
    // Target modern browsers; Salesforce supports evergreen browsers.
    target: 'es2020',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
