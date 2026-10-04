/**
 * Builds the Android app and copies it to release/amar-shorir.apk — the file
 * to send to a phone. Run through `npm run android:apk`, which first builds the
 * site with APP_BUILD=1 and copies it into android/ (`cap sync`).
 *
 * Needs JDK 21 and the Android SDK. Set JAVA_HOME and ANDROID_HOME, or keep
 * them in the folders listed in `guesses` below.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const android = join(root, "android");
const windows = process.platform === "win32";

function firstExisting(paths) {
  return paths.find((path) => path && existsSync(path));
}

const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
const javaHome = firstExisting([
  process.env.JAVA_HOME,
  ...(existsSync("E:/dev-tools/jdk") ? readdirSync("E:/dev-tools/jdk").map((name) => join("E:/dev-tools/jdk", name)) : []),
  "C:/Program Files/Android/Android Studio/jbr",
]);
const androidHome = firstExisting([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  "E:/dev-tools/android-sdk",
  join(home, "AppData/Local/Android/Sdk"),
  join(home, "Library/Android/sdk"),
  join(home, "Android/Sdk"),
]);
if (!javaHome || !androidHome) {
  console.error(`Missing ${!javaHome ? "JDK 21 (set JAVA_HOME)" : "Android SDK (set ANDROID_HOME)"}.`);
  process.exit(1);
}

const gradlew = join(android, windows ? "gradlew.bat" : "gradlew");
// .bat files need a shell on Windows, and the shell splits unquoted paths at spaces.
const result = spawnSync(windows ? `"${gradlew}"` : gradlew, ["assembleDebug", "--console=plain"], {
  cwd: android,
  stdio: "inherit",
  shell: windows,
  env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome },
});
if (result.status !== 0) process.exit(result.status ?? 1);

const built = join(android, "app/build/outputs/apk/debug/app-debug.apk");
const target = join(root, "release/amar-shorir.apk");
mkdirSync(join(root, "release"), { recursive: true });
copyFileSync(built, target);
console.log(`\nAPK ready (${(statSync(target).size / 1024 / 1024).toFixed(1)} MB): ${target}`);
