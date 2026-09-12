import type {
  SettingsFieldsFragment,
  SettingsToolDiscoveryEnum,
  UpdateSettingInput,
} from "@/__generated__/graphql";
import { forPicker, idOrNone } from "@/lib/picker";

/**
 * The settings row as the Settings page edits it, and the sections it is split into.
 *
 * Pure, and apart from the page, because the part of that page that went wrong was never the
 * drawing: it was which values the form held and what it compared them against.
 */

/** No agent named: whichever enabled one comes first by name. */
export const ANY_AGENT = "__any__";

/**
 * The panels behind `/settings`, in the order they are shown.
 *
 * Model leads because the model pickers on every other panel have nothing to list until it is
 * filled in. Connect edits nothing, and is here so that `?tab=connect` can be a link.
 */
export const SETTINGS_SECTIONS = [
  { key: "model", label: "Model" },
  { key: "limits", label: "Limits" },
  { key: "tools", label: "Tools" },
  { key: "refining", label: "Refining" },
  { key: "server", label: "Server" },
  { key: "connect", label: "Connect" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["key"];

export const isSettingsSection = (value: unknown): value is SettingsSection =>
  SETTINGS_SECTIONS.some((section) => section.key === value);

export const sectionLabel = (key: SettingsSection) =>
  SETTINGS_SECTIONS.find((section) => section.key === key)?.label ?? key;

/**
 * The row as the form holds it: the numbers stay numbers, and a box emptied on the way to
 * retyping one is `null` rather than a silent zero — which the page's validator refuses, in the
 * field, instead of writing 0 to a column every agent falls back to.
 */
export interface SettingsForm {
  baseUrl: string;
  /** Write-only: never read back, so empty means "keep the stored one". */
  apiKey: string;
  model: string;
  maxTokens: number | null;
  contextLength: number | null;
  temperature: number | null;
  maxToolIterations: number | null;
  requestTimeoutSeconds: number | null;
  maxRetries: number | null;
  toolDiscovery: SettingsToolDiscoveryEnum;
  toolSelectModel: string;
  refineAgentId: string;
  refinePrompt: string;
  runRetentionDays: number | null;
  workerIntervalSeconds: number | null;
}

/**
 * Which panel each field is on.
 *
 * Field-to-panel rather than panel-to-fields so that the `Record` has to be complete: a column
 * added to the form and placed nowhere is a type error here, rather than a field that never
 * marks its tab as holding a change.
 */
export const SECTION_OF: Record<keyof SettingsForm, Exclude<SettingsSection, "connect">> = {
  baseUrl: "model",
  apiKey: "model",
  model: "model",
  maxTokens: "limits",
  contextLength: "limits",
  temperature: "limits",
  maxToolIterations: "limits",
  requestTimeoutSeconds: "limits",
  maxRetries: "limits",
  toolDiscovery: "tools",
  toolSelectModel: "tools",
  refineAgentId: "refining",
  refinePrompt: "refining",
  runRetentionDays: "server",
  workerIntervalSeconds: "server",
};

/** A form seeded from the stored row. The key box starts empty, which is what keeps the key. */
export const toForm = (row: SettingsFieldsFragment): SettingsForm => ({
  baseUrl: row.baseUrl,
  apiKey: "",
  model: row.model,
  maxTokens: row.maxTokens,
  contextLength: row.contextLength,
  temperature: row.temperature,
  maxToolIterations: row.maxToolIterations,
  requestTimeoutSeconds: row.requestTimeoutSeconds,
  maxRetries: row.maxRetries,
  toolDiscovery: row.toolDiscovery,
  toolSelectModel: row.toolSelectModel,
  refineAgentId: forPicker(row.refineAgentId, ANY_AGENT),
  refinePrompt: row.refinePrompt,
  runRetentionDays: row.runRetentionDays,
  workerIntervalSeconds: row.workerIntervalSeconds,
});

/**
 * The form as the `updateSetting` input. The key is not in it: it travels on `setApiKey`,
 * being excluded from the type entirely. A `null` never reaches here past the validator, and
 * the fallbacks are each column's own "inherit".
 */
export const toRow = (form: SettingsForm): UpdateSettingInput => ({
  baseUrl: form.baseUrl,
  model: form.model,
  maxTokens: form.maxTokens ?? 0,
  contextLength: form.contextLength ?? 0,
  temperature: form.temperature ?? -1,
  maxToolIterations: form.maxToolIterations ?? 0,
  requestTimeoutSeconds: form.requestTimeoutSeconds ?? 0,
  maxRetries: form.maxRetries ?? -1,
  toolDiscovery: form.toolDiscovery,
  toolSelectModel: form.toolSelectModel,
  // An unnamed agent is no row, not a row with an empty id.
  refineAgentId: idOrNone(form.refineAgentId, ANY_AGENT),
  refinePrompt: form.refinePrompt,
  runRetentionDays: form.runRetentionDays ?? 0,
  workerIntervalSeconds: form.workerIntervalSeconds ?? 0,
});

/**
 * Which panels hold a change, in tab order, compared field by field against the row as it
 * stands — not against a snapshot from when the page opened, since a tab left open all
 * afternoon is exactly the one that would save over somebody else's edit.
 */
export function dirtySections(
  form: SettingsForm,
  row: SettingsFieldsFragment | undefined,
): SettingsSection[] {
  if (!row) return [];
  const stored = toForm(row);
  const dirty = new Set<SettingsSection>();
  for (const key of Object.keys(SECTION_OF) as (keyof SettingsForm)[]) {
    if (form[key] !== stored[key]) dirty.add(SECTION_OF[key]);
  }
  return SETTINGS_SECTIONS.map((section) => section.key).filter((key) => dirty.has(key));
}
