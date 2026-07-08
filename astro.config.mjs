import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://example.com",
  build: {
    inlineStylesheets: "always",
  },
});
