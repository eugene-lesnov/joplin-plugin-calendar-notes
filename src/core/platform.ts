import joplin from "api";

let mobilePlatform: boolean | null = null;

export async function isMobilePlatform(): Promise<boolean> {
  if (mobilePlatform !== null) {
    return mobilePlatform;
  }

  try {
    mobilePlatform = (await joplin.versionInfo()).platform === "mobile";
  } catch (error) {
    console.warn("Failed to detect Joplin platform.", error);
    mobilePlatform = false;
  }

  return mobilePlatform;
}
