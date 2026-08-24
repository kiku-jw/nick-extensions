import { isAllowedStudyNavPageUrl } from './page-origin';

export type PageMessageTab = {
  id?: number;
  url?: string;
  active?: boolean;
};

export function rankStudyNavPageTabs(groups: PageMessageTab[][]): PageMessageTab[] {
  const unique = new Map<number, PageMessageTab>();
  for (const group of groups) {
    for (const tab of group) {
      if (typeof tab.id !== 'number' || unique.has(tab.id)) continue;
      if (typeof tab.url === 'string' && !isAllowedStudyNavPageUrl(tab.url)) continue;
      unique.set(tab.id, tab);
    }
  }
  return [...unique.values()].sort((left, right) => {
    const score = (tab: PageMessageTab) =>
      (typeof tab.url === 'string' && isAllowedStudyNavPageUrl(tab.url) ? 2 : 0) +
      (tab.active ? 1 : 0);
    return score(right) - score(left);
  });
}
