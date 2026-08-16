import { normalizeAllowlistHosts } from './hosts';

export type ClearShieldSettings = {
  enabled: boolean;
  allowlist: string[]; // hostnames
  lists: {
    easylist: boolean;
    easyprivacy: boolean;
    baseline: boolean;
  };
  cosmetic: boolean;
  blockedTotal: number;
};

export const DEFAULT_SETTINGS: ClearShieldSettings = {
  enabled: true,
  allowlist: [],
  lists: { easylist: true, easyprivacy: true, baseline: true },
  cosmetic: true,
  blockedTotal: 0,
};

export const LIST_IDS = ['easylist', 'easyprivacy', 'baseline'] as const;
export type ListId = (typeof LIST_IDS)[number];

export const LIST_META: { id: ListId; label: string; hint: string }[] = [
  { id: 'easylist', label: 'EasyList', hint: 'Ads (converted subset)' },
  { id: 'easyprivacy', label: 'EasyPrivacy', hint: 'Trackers (converted subset)' },
  { id: 'baseline', label: 'Baseline', hint: 'Bundled common ad/tracker hosts' },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function coerceSettings(raw: unknown): ClearShieldSettings {
  const record = asRecord(raw);
  const lists = asRecord(record.lists);

  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_SETTINGS.enabled,
    allowlist: normalizeAllowlistHosts(Array.isArray(record.allowlist) ? record.allowlist : DEFAULT_SETTINGS.allowlist),
    lists: {
      easylist: typeof lists.easylist === 'boolean' ? lists.easylist : DEFAULT_SETTINGS.lists.easylist,
      easyprivacy: typeof lists.easyprivacy === 'boolean' ? lists.easyprivacy : DEFAULT_SETTINGS.lists.easyprivacy,
      baseline: typeof lists.baseline === 'boolean' ? lists.baseline : DEFAULT_SETTINGS.lists.baseline,
    },
    cosmetic: typeof record.cosmetic === 'boolean' ? record.cosmetic : DEFAULT_SETTINGS.cosmetic,
    blockedTotal:
      typeof record.blockedTotal === 'number' && Number.isFinite(record.blockedTotal)
        ? record.blockedTotal
        : DEFAULT_SETTINGS.blockedTotal,
  };
}
