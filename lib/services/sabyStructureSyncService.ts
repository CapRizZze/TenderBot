import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sabyTreeService, type SabyTreeItem } from "@/lib/services/sabyTreeService";

interface SyncStructureResult {
  foldersCount: number;
  queriesCount: number;
}

export class SabyStructureSyncService {
  async syncRootFoldersAndQueries(): Promise<SyncStructureResult> {
    const syncRun = await prisma.sabyStructureSyncRun.create({
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });

    try {
      const rootItems = await sabyTreeService.getRootItems();
      let foldersCount = 0;
      let queriesCount = 0;

      for (const item of rootItems) {
        if (item.kind === "folder") {
          foldersCount += 1;
          queriesCount += await this.syncFolder(item);
          continue;
        }

        if (item.kind === "query") {
          queriesCount += 1;
          await this.syncQuery(item, null);
        }
      }

      await prisma.sabyStructureSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "success",
          finishedAt: new Date(),
          foldersCount,
          queriesCount,
        },
      });

      return { foldersCount, queriesCount };
    } catch (error) {
      await prisma.sabyStructureSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "error",
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : "Unknown sync error",
        },
      });

      throw error;
    }
  }

  async syncFolder(folder: SabyTreeItem): Promise<number> {
    const savedFolder = await prisma.sabyFolder.upsert({
      where: {
        sabyFolderId: folder.id,
      },
      update: {
        name: folder.name,
        isActive: folder.active ?? true,
      },
      create: {
        sabyFolderId: folder.id,
        name: folder.name,
        isActive: folder.active ?? true,
      },
    });

    const items = await sabyTreeService.getFolderItems(folder.id);
    let queriesCount = 0;

    for (const item of items) {
      if (item.kind !== "query") {
        continue;
      }

      queriesCount += 1;
      await this.syncQuery(item, savedFolder.id);
    }

    return queriesCount;
  }

  async syncQuery(query: SabyTreeItem, folderId: string | null): Promise<void> {
    const rawConfig = await sabyTreeService.getQueryConfig(query.id);
    const rawConfigJson = rawConfig as Prisma.InputJsonValue;

    await prisma.sabyQuery.upsert({
      where: {
        sabyQueryId: query.id,
      },
      update: {
        folderId,
        name: query.name,
        parentFolderName:
          typeof rawConfig.parent_name === "string" ? rawConfig.parent_name : null,
        ftsString:
          typeof rawConfig.fts_string === "string" ? rawConfig.fts_string : "",
        ftsStringExclude:
          typeof rawConfig.fts_string_exclude === "string"
            ? rawConfig.fts_string_exclude
            : "",
        rawConfigJson,
        isActive: query.active ?? true,
        lastSyncedAt: new Date(),
      },
      create: {
        sabyQueryId: query.id,
        folderId,
        name: query.name,
        parentFolderName:
          typeof rawConfig.parent_name === "string" ? rawConfig.parent_name : null,
        ftsString:
          typeof rawConfig.fts_string === "string" ? rawConfig.fts_string : "",
        ftsStringExclude:
          typeof rawConfig.fts_string_exclude === "string"
            ? rawConfig.fts_string_exclude
            : "",
        rawConfigJson,
        isActive: query.active ?? true,
        lastSyncedAt: new Date(),
      },
    });
  }
}

export const sabyStructureSyncService = new SabyStructureSyncService();
