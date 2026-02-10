/**
 * Folder Service for reMarkable
 * Provides folder browsing and management functionality.
 */

import type { FastifyInstance } from "fastify";
import { getRemarkableClient, type RemarkableDocument } from "./client.js";

/**
 * Folder representation for UI
 */
export interface RemarkableFolder {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  children: RemarkableFolder[];
  documentCount: number;
}

/**
 * Folder tree node
 */
export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  children: FolderTreeNode[];
}

/**
 * Build folder path from document
 */
function buildFolderPath(
  folderId: string,
  folderMap: Map<string, RemarkableDocument>
): string {
  const folder = folderMap.get(folderId);
  if (!folder) return "";

  if (!folder.parent) {
    return "/" + folder.name;
  }

  const parentPath = buildFolderPath(folder.parent, folderMap);
  return parentPath + "/" + folder.name;
}

/**
 * Get all folders from reMarkable
 */
export async function getRemarkableFolders(
  fastify: FastifyInstance,
  userId: string
): Promise<RemarkableFolder[]> {
  const client = getRemarkableClient(fastify, userId);
  const documents = await client.getDocuments();

  // Separate folders and documents
  const folders = documents.filter((d) => d.type === "CollectionType");
  const docs = documents.filter((d) => d.type === "DocumentType");

  // Create folder map
  const folderMap = new Map<string, RemarkableDocument>();
  for (const folder of folders) {
    folderMap.set(folder.id, folder);
  }

  // Build folder structures
  const result: RemarkableFolder[] = [];
  const folderById = new Map<string, RemarkableFolder>();

  for (const folder of folders) {
    const path = buildFolderPath(folder.id, folderMap);
    const docCount = docs.filter((d) => d.parent === folder.id).length;

    const folderData: RemarkableFolder = {
      id: folder.id,
      name: folder.name,
      path,
      parentId: folder.parent || null,
      children: [],
      documentCount: docCount,
    };

    folderById.set(folder.id, folderData);
  }

  // Build hierarchy
  for (const folder of folderById.values()) {
    if (folder.parentId) {
      const parent = folderById.get(folder.parentId);
      if (parent) {
        parent.children.push(folder);
      } else {
        result.push(folder);
      }
    } else {
      result.push(folder);
    }
  }

  // Sort folders alphabetically
  const sortFolders = (folders: RemarkableFolder[]) => {
    folders.sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      sortFolders(folder.children);
    }
  };

  sortFolders(result);

  return result;
}

/**
 * Get folder tree (simplified for dropdown)
 */
export async function getFolderTree(
  fastify: FastifyInstance,
  userId: string
): Promise<FolderTreeNode[]> {
  const folders = await getRemarkableFolders(fastify, userId);

  const convertToTreeNode = (folder: RemarkableFolder): FolderTreeNode => ({
    id: folder.id,
    name: folder.name,
    path: folder.path,
    children: folder.children.map(convertToTreeNode),
  });

  return folders.map(convertToTreeNode);
}

/**
 * Get documents in a folder
 */
export async function getFolderDocuments(
  fastify: FastifyInstance,
  userId: string,
  folderPath: string
): Promise<RemarkableDocument[]> {
  const client = getRemarkableClient(fastify, userId);
  return client.getDocuments(folderPath);
}

/**
 * Create a new folder
 */
export async function createFolder(
  fastify: FastifyInstance,
  userId: string,
  folderPath: string
): Promise<{ id: string; path: string }> {
  const client = getRemarkableClient(fastify, userId);
  const folderId = await client.createFolder(folderPath);

  return {
    id: folderId,
    path: folderPath,
  };
}

/**
 * Get folder by path
 */
export async function getFolderByPath(
  fastify: FastifyInstance,
  userId: string,
  folderPath: string
): Promise<RemarkableFolder | null> {
  const folders = await getRemarkableFolders(fastify, userId);

  const findFolder = (
    folders: RemarkableFolder[],
    path: string
  ): RemarkableFolder | null => {
    for (const folder of folders) {
      if (folder.path === path) {
        return folder;
      }
      const found = findFolder(folder.children, path);
      if (found) return found;
    }
    return null;
  };

  return findFolder(folders, folderPath);
}

/**
 * Check if folder exists
 */
export async function folderExists(
  fastify: FastifyInstance,
  userId: string,
  folderPath: string
): Promise<boolean> {
  const folder = await getFolderByPath(fastify, userId, folderPath);
  return folder !== null;
}

/**
 * Get suggested folder paths based on usage patterns
 */
export function getSuggestedFolderPaths(): string[] {
  return [
    "/Calendar",
    "/Calendar/Daily Agenda",
    "/Calendar/Weekly Planner",
    "/Calendar/Notes",
    "/Calendar/Habit Tracker",
    "/Calendar/Processed",
    "/Work",
    "/Personal",
    "/Projects",
  ];
}
