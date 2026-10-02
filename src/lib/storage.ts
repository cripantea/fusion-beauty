import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Root of the local file storage (a persistent Docker volume in production).
 * It is a runtime location outside the app bundle, so Turbopack must not trace it
 * (that would pull the whole project into the standalone output).
 */
function getStorageRoot() {
  return path.resolve(
    /*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? path.join(process.cwd(), "data", "storage")
  );
}

/** Resolves a storage key to an absolute path, refusing anything outside the root. */
function resolveKey(key: string) {
  const root = getStorageRoot();
  const fullPath = path.resolve(root, key);

  if (!fullPath.startsWith(root + path.sep)) {
    throw new Error("Invalid storage key");
  }

  return fullPath;
}

export async function writeStorageFile(key: string, data: Buffer): Promise<void> {
  const fullPath = resolveKey(key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);
}

export async function removeStorageFile(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}

export async function readStorageFile(key: string): Promise<Buffer> {
  return readFile(/*turbopackIgnore: true*/ resolveKey(key));
}
