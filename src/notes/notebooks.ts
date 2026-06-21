import joplin from "api";

import type { FolderSummary } from "../core/types";

function normalizeParentId(parentId: string | undefined | null): string {
  return parentId ?? "";
}

export function splitNotebookPath(path: string): string[] {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

async function getAllFolders(): Promise<FolderSummary[]> {
  const result: FolderSummary[] = [];
  let page = 1;

  while (true) {
    const response = await joplin.data.get(["folders"], {
      fields: ["id", "title", "parent_id"],
      limit: 100,
      page,
    });

    result.push(...(response.items as FolderSummary[]));

    if (!response.has_more) {
      break;
    }

    page += 1;
  }

  return result;
}

function collectDescendantFolderIds(
  folders: FolderSummary[],
  parentId: string,
  result: Set<string>,
): void {
  for (const folder of folders) {
    if (normalizeParentId(folder.parent_id) !== parentId) {
      continue;
    }

    result.add(folder.id);
    collectDescendantFolderIds(folders, folder.id, result);
  }
}

function findChildFolder(
  folders: FolderSummary[],
  parentId: string,
  title: string,
): FolderSummary | null {
  const normalizedParentId = normalizeParentId(parentId);

  const exact = folders.find((folder) => {
    return (
      normalizeParentId(folder.parent_id) === normalizedParentId &&
      folder.title === title
    );
  });

  if (exact) {
    return exact;
  }

  const lowerTitle = title.toLocaleLowerCase();

  return (
    folders.find((folder) => {
      return (
        normalizeParentId(folder.parent_id) === normalizedParentId &&
        folder.title.toLocaleLowerCase() === lowerTitle
      );
    }) ?? null
  );
}

function resolveNotebookPathFromFolders(
  folders: FolderSummary[],
  path: string,
): FolderSummary | null {
  const segments = splitNotebookPath(path);

  if (segments.length === 0) {
    return null;
  }

  let parentId = "";
  let current: FolderSummary | null = null;

  for (const segment of segments) {
    current = findChildFolder(folders, parentId, segment);

    if (!current) {
      return null;
    }

    parentId = current.id;
  }

  return current;
}

export async function resolveNotebookPath(
  path: string,
): Promise<FolderSummary | null> {
  return resolveNotebookPathFromFolders(await getAllFolders(), path);
}

export async function getNotebookTreeIdsForPaths(
  paths: string[],
): Promise<Map<string, Set<string>>> {
  const folders = await getAllFolders();
  const result = new Map<string, Set<string>>();

  for (const path of paths) {
    if (result.has(path)) {
      continue;
    }

    const rootFolder = resolveNotebookPathFromFolders(folders, path);

    if (!rootFolder) {
      result.set(path, new Set());
      continue;
    }

    const ids = new Set<string>([rootFolder.id]);
    collectDescendantFolderIds(folders, rootFolder.id, ids);
    result.set(path, ids);
  }

  return result;
}

export async function getNotebookTreeIds(path: string): Promise<Set<string>> {
  const resolved = await getNotebookTreeIdsForPaths([path]);

  return resolved.get(path) ?? new Set();
}

export async function ensureNotebookPath(
  path: string,
): Promise<FolderSummary | null> {
  const segments = splitNotebookPath(path);

  if (segments.length === 0) {
    return null;
  }

  const folders = await getAllFolders();

  let parentId = "";
  let current: FolderSummary | null = null;

  for (const segment of segments) {
    const existing = findChildFolder(folders, parentId, segment);

    if (existing) {
      current = existing;
      parentId = existing.id;
      continue;
    }

    current = (await joplin.data.post(["folders"], null, {
      title: segment,
      parent_id: parentId || undefined,
    })) as FolderSummary;

    folders.push(current);
    parentId = current.id;
  }

  return current;
}

