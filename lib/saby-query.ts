export interface SabyQueryIdentityLike {
  id: string;
  name: string;
  parentFolderName?: string | null;
}

export function buildSabyQueryCacheKey(queryId: string) {
  return `saby-query:${queryId}`;
}

export function formatSabyQueryLabel(query: Pick<SabyQueryIdentityLike, "name" | "parentFolderName">) {
  return query.parentFolderName?.trim()
    ? `${query.parentFolderName.trim()} / ${query.name}`
    : query.name;
}
