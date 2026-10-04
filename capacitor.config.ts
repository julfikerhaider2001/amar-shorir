import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Android and iOS apps wrap the static export in `out/` (built with
 * `APP_BUILD=1`, no base path). Every model, picture and narration clip ships
 * inside the app, so it works with no internet.
 */
const config: CapacitorConfig = {
  appId: "com.amarshorir.app",
  appName: "আমার শরীর",
  webDir: "out",
  backgroundColor: "#fff4d6",
  ios: {
    contentInset: "never",
  },
};

export default config;
