import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL || "https://mywebsite.pages.dev",
  build: {
    inlineStylesheets: "auto",
  },
});
