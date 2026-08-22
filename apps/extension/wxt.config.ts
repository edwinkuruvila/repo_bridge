import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "RepoBridge",
    description:
      "Connect ChatGPT to local code repositories with explicit access controls.",
    version: "0.1.0",
    permissions: ["nativeMessaging", "storage"],
    browser_specific_settings: {
      gecko: {
        id: "repobridge@localhost",
        data_collection_permissions: {
          required: ["websiteContent"],
        },
      },
    },
  },
  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      if (wxt.config.browser !== "firefox") {
        delete manifest.browser_specific_settings;
      }
    },
  },
});
