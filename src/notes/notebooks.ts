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

export async function resolveNotebookPath(
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
    current = findChildFolder(folders, parentId, segment);

    if (!current) {
      return null;
    }

    parentId = current.id;
  }

  return current;
}


export async function getFallbackFolderId(): Promise<string | null> {
  const selectedFolder = await joplin.workspace.selectedFolder();

  if (selectedFolder?.id) {
    return selectedFolder.id;
  }

  const folders = await joplin.data.get(["folders"], {
    fields: ["id", "title"],
    limit: 1,
  });

  return folders.items?.[0]?.id ?? null;
}
