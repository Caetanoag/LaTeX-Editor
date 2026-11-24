export type StorageLike = {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
};

export const TAGS_STORAGE_PREFIX = "workspaceTags:";
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const TAGS_FIELD_LABEL = "Tags (this browser only)";
export const TAGS_HELP_TEXT =
	"Saved only in this browser. They are not shared with other users or devices; anyone using this browser can see them.";
export const TAGS_CHIPS_LABEL = "Local tags (this browser only)";
export const TAGS_GROUP_ARIA_LABEL =
	"Local tags for this workspace, saved only in this browser";
export const TAGS_VALIDATION_ERROR =
	"Use at most 10 tags of up to 30 characters each.";
export const TAGS_SAVE_ERROR = "Could not save tags in this browser.";
export const TAGS_MORE_TITLE = (count: number): string =>
	`${count} more local tags`;

const workspaceKey = (workspaceId: string): string =>
	`${TAGS_STORAGE_PREFIX}${workspaceId}`;

const storageFor = (storage?: StorageLike): StorageLike =>
	storage ?? localStorage;

export const normalizeTags = (input: unknown): string[] => {
	if (typeof input !== "string") return [];

	const seen = new Set<string>();
	const tags: string[] = [];
	for (const token of input.split(",")) {
		const tag = token.trim();
		const folded = tag.toLocaleLowerCase();
		if (tag === "" || seen.has(folded)) continue;
		seen.add(folded);
		tags.push(tag);
	}
	return tags;
};

export const isValidTags = (input: unknown): boolean => {
	const tags = normalizeTags(input);
	return (
		tags.length <= MAX_TAGS &&
		tags.every((tag) => [...tag].length <= MAX_TAG_LENGTH)
	);
};

export const formatTagsInput = (tags: string[]): string => tags.join(", ");

export const readWorkspaceTags = (
	workspaceId: string,
	storage?: StorageLike,
): string[] => {
	try {
		const raw = storageFor(storage).getItem(workspaceKey(workspaceId));
		if (raw === null) return [];
		const parsed: unknown = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.every((item) => typeof item === "string")
		) {
			return parsed as string[];
		}
	} catch {
		// Corrupted local data is treated as no tags.
	}
	return [];
};

export const writeWorkspaceTags = (
	workspaceId: string,
	tags: string[],
	storage?: StorageLike,
): boolean => {
	const key = workspaceKey(workspaceId);
	const normalized = normalizeTags(tags.join(","));
	try {
		if (normalized.length === 0) storageFor(storage).removeItem(key);
		else storageFor(storage).setItem(key, JSON.stringify(normalized));
		return true;
	} catch {
		return false;
	}
};

export const removeWorkspaceTags = (
	workspaceId: string,
	storage?: StorageLike,
): void => {
	try {
		storageFor(storage).removeItem(workspaceKey(workspaceId));
	} catch {
		// Tags are local metadata; cleanup failure must not break deletion.
	}
};
