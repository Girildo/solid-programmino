import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

/** Builds the app as a library so tools/smoke.mjs can drive it under jsdom. */
export default defineConfig({
  plugins: [solid()],
  build: {
    lib: { entry: "tools/smoke-entry.tsx", formats: ["es"], fileName: () => "app-bundle.mjs" },
    outDir: "tools/smoke-out",
    emptyOutDir: true,
    minify: false,
    rollupOptions: { external: ["solid-js", "solid-js/web", "solid-js/store"] },
  },
})
