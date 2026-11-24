import { describe, expect, it } from "bun:test";
import {
	formatTagsInput,
	isValidTags,
	MAX_TAG_LENGTH,
	MAX_TAGS,
	normalizeTags,
	readWorkspaceTags,
	removeWorkspaceTags,
	type StorageLike,
	TAGS_CHIPS_LABEL,
	TAGS_FIELD_LABEL,
	TAGS_GROUP_ARIA_LABEL,
	TAGS_HELP_TEXT,
	TAGS_MORE_TITLE,
	TAGS_SAVE_ERROR,
	TAGS_STORAGE_PREFIX,
	TAGS_VALIDATION_ERROR,
	writeWorkspaceTags,
} from "../shared/workspace-tags";

type FakeStorage = StorageLike & {
	entries: () => Map<string, string>;
	failSetItem: boolean;
};

function createFakeStorage(): FakeStorage {
	const data = new Map<string, string>();
	const storage: FakeStorage = {
		failSetItem: false,
		entries: () => new Map(data),
		getItem(key) {
			return data.get(key) ?? null;
		},
		setItem(key, value) {
			if (storage.failSetItem) throw new Error("Simulated setItem failure");
			data.set(key, value);
		},
		removeItem(key) {
			data.delete(key);
		},
	};
	return storage;
}

const keyFor = (workspaceId: string) => `${TAGS_STORAGE_PREFIX}${workspaceId}`;

describe("workspace-tags module contract", () => {
	describe("exported copy and limits", () => {
		it("exposes the exact storage prefix and limits", () => {
			expect(
				TAGS_STORAGE_PREFIX,
				"TAGS_STORAGE_PREFIX must namespace keys under workspaceTags:",
			).toBe("workspaceTags:");
			expect(MAX_TAGS, "MAX_TAGS must be 10").toBe(10);
			expect(MAX_TAG_LENGTH, "MAX_TAG_LENGTH must be 30").toBe(30);
		});

		it("exposes exact UI copy, including the local-visibility warning", () => {
			expect(TAGS_FIELD_LABEL, "Field label must say tags are local").toBe(
				"Tags (this browser only)",
			);
			expect(
				TAGS_HELP_TEXT,
				"Help text must warn that anyone using this browser can see the tags",
			).toBe(
				"Saved only in this browser. They are not shared with other users or devices; anyone using this browser can see them.",
			);
			expect(
				TAGS_CHIPS_LABEL,
				"Chips label must identify them as local tags",
			).toBe("Local tags (this browser only)");
			expect(
				TAGS_GROUP_ARIA_LABEL,
				"Group aria label must state that tags are saved only in this browser",
			).toBe("Local tags for this workspace, saved only in this browser");
			expect(
				TAGS_VALIDATION_ERROR,
				"Validation error must state both limits",
			).toBe("Use at most 10 tags of up to 30 characters each.");
			expect(
				TAGS_SAVE_ERROR,
				"Save error must say tags could not be saved in this browser",
			).toBe("Could not save tags in this browser.");
			expect(
				TAGS_MORE_TITLE(3),
				"Overflow chips title must include the hidden tag count",
			).toBe("3 more local tags");
			expect(
				TAGS_MORE_TITLE(1),
				"Overflow chips title must use the exact template for any count",
			).toBe("1 more local tags");
		});
	});

	describe("normalizeTags", () => {
		it("returns [] without throwing for non-string input", () => {
			const inputs: unknown[] = [
				undefined,
				null,
				42,
				{ tags: "a" },
				["a", "b"],
			];
			for (const input of inputs) {
				expect(
					normalizeTags(input),
					`normalizeTags(${JSON.stringify(input)}) must return [] because only strings are accepted`,
				).toEqual([]);
			}
		});

		it("splits, trims, drops empty tokens and deduplicates case-insensitively", () => {
			expect(
				normalizeTags("draft, LaTeX,  relatório, draft "),
				"Expected comma splitting, trimmed tokens and the declared example result",
			).toEqual(["draft", "LaTeX", "relatório"]);
		});

		it("drops repeated commas, trailing commas and blank strings", () => {
			expect(
				normalizeTags("a,,b,"),
				"Repeated/trailing commas must not create tags",
			).toEqual(["a", "b"]);
			expect(
				normalizeTags(" , , "),
				"A comma-only string must normalize to []",
			).toEqual([]);
			expect(normalizeTags(""), "An empty string must normalize to []").toEqual(
				[],
			);
		});

		it("preserves the first spelling when tags differ only by case", () => {
			expect(
				normalizeTags("Draft, draft, DRAFT, LaTex, latex"),
				"Case-insensitive deduplication must keep the first occurrence's spelling",
			).toEqual(["Draft", "LaTex"]);
		});
	});

	describe("isValidTags", () => {
		it("accepts normalized lists at or below the limits", () => {
			expect(
				isValidTags("draft, LaTeX,  relatório, draft "),
				"A normalized list of three tags must be valid",
			).toBe(true);
			expect(isValidTags(""), "An empty list must be valid").toBe(true);
			expect(isValidTags(",, ,"), "A comma-only list must be valid").toBe(true);

			const ten = Array.from({ length: 10 }, (_, index) => `tag${index}`).join(
				",",
			);
			expect(isValidTags(ten), "Exactly 10 tags must be valid").toBe(true);
		});

		it("rejects more than 10 normalized tags", () => {
			const eleven = Array.from(
				{ length: 11 },
				(_, index) => `tag${index}`,
			).join(",");
			expect(isValidTags(eleven), "11 tags must be invalid").toBe(false);
		});

		it("counts 30 Unicode code points after trimming, not UTF-16 units", () => {
			const thirtyEmoji = "😀".repeat(30);
			expect(
				isValidTags(thirtyEmoji),
				"30 code points must be valid even when each uses two UTF-16 units",
			).toBe(true);
			expect(
				isValidTags(`${thirtyEmoji}😀`),
				"31 code points must be invalid",
			).toBe(false);
			expect(
				isValidTags(`  ${"a".repeat(30)}  `),
				"Length must be measured after trimming",
			).toBe(true);
			expect(
				isValidTags(`  ${"a".repeat(31)}  `),
				"Trimming must not hide a 31-code-point tag",
			).toBe(false);
		});
	});

	describe("formatTagsInput", () => {
		it("joins tags with a comma and a space", () => {
			expect(formatTagsInput(["a", "b"]), 'Expected "a, b"').toBe("a, b");
		});

		it("formats an empty list as an empty string", () => {
			expect(formatTagsInput([]), 'An empty list must format as ""').toBe("");
		});
	});

	describe("readWorkspaceTags", () => {
		it("returns [] when the key is absent", () => {
			const storage = createFakeStorage();
			expect(
				readWorkspaceTags("ws-1", storage),
				"Missing keys must read as []",
			).toEqual([]);
			expect(
				storage.entries().has(keyFor("ws-1")),
				"Reading a missing key must not create it",
			).toBe(false);
		});

		it("returns a stored array of strings as-is", () => {
			const storage = createFakeStorage();
			const tags = ["one", "Two words", "😀"];
			storage.setItem(keyFor("ws-1"), JSON.stringify(tags));
			expect(
				readWorkspaceTags("ws-1", storage),
				"A valid string array must be returned unchanged",
			).toEqual(tags);
		});

		it("returns [] for malformed JSON or JSON that is not a string array", () => {
			const storage = createFakeStorage();
			const key = keyFor("ws-1");
			const invalidValues = [
				"not json",
				JSON.stringify({ tags: ["a"] }),
				JSON.stringify([1, "a"]),
				JSON.stringify(["a", null]),
				JSON.stringify("a"),
				JSON.stringify(null),
			];
			for (const value of invalidValues) {
				storage.setItem(key, value);
				expect(
					readWorkspaceTags("ws-1", storage),
					`Stored value ${value} must be ignored without throwing`,
				).toEqual([]);
			}
		});

		it("does not mix tags between workspace ids", () => {
			const storage = createFakeStorage();
			storage.setItem(keyFor("ws-1"), JSON.stringify(["only-one"]));
			expect(
				readWorkspaceTags("ws-1", storage),
				"ws-1 tags must be readable",
			).toEqual(["only-one"]);
			expect(
				readWorkspaceTags("ws-2", storage),
				"ws-2 must not see ws-1 tags",
			).toEqual([]);
		});
	});

	describe("writeWorkspaceTags", () => {
		it("writes normalized tags as JSON under the prefixed workspace key", () => {
			const storage = createFakeStorage();
			expect(
				writeWorkspaceTags(
					"ws-1",
					[" draft ", "LaTeX", "draft", " relatório ", ""],
					storage,
				),
				"A successful write must return true",
			).toBe(true);
			expect(
				storage.getItem(keyFor("ws-1")),
				"Writes must normalize the tag list before serializing it",
			).toBe(JSON.stringify(["draft", "LaTeX", "relatório"]));
		});

		it("removes the key when normalization leaves no tags", () => {
			const storage = createFakeStorage();
			storage.setItem(keyFor("ws-1"), JSON.stringify(["old"]));
			expect(
				writeWorkspaceTags("ws-1", ["", "  ", " , "], storage),
				"An empty normalized result must still be reported as a successful write",
			).toBe(true);
			expect(
				storage.getItem(keyFor("ws-1")),
				"An empty result must remove the key instead of storing []",
			).toBeNull();
			expect(
				storage.entries().has(keyFor("ws-1")),
				"The key must not exist after saving no tags",
			).toBe(false);
		});

		it("returns false and does not throw when setItem fails", () => {
			const storage = createFakeStorage();
			storage.failSetItem = true;
			expect(
				writeWorkspaceTags("ws-1", ["a"], storage),
				"A storage failure must be reported as false, not thrown",
			).toBe(false);
			expect(
				storage.getItem(keyFor("ws-1")),
				"Nothing should be persisted",
			).toBeNull();
		});

		it("keys each workspace independently", () => {
			const storage = createFakeStorage();
			writeWorkspaceTags("ws-1", ["one"], storage);
			writeWorkspaceTags("ws-2", ["two"], storage);
			expect(
				storage.getItem(keyFor("ws-1")),
				"ws-1 must keep its own tags",
			).toBe(JSON.stringify(["one"]));
			expect(
				storage.getItem(keyFor("ws-2")),
				"ws-2 must keep its own tags",
			).toBe(JSON.stringify(["two"]));
		});
	});

	describe("removeWorkspaceTags", () => {
		it("removes only the key for the given workspace", () => {
			const storage = createFakeStorage();
			storage.setItem(keyFor("ws-1"), JSON.stringify(["one"]));
			storage.setItem(keyFor("ws-2"), JSON.stringify(["two"]));
			expect(
				() => removeWorkspaceTags("ws-1", storage),
				"Removing an existing key must not throw",
			).not.toThrow();
			expect(
				storage.getItem(keyFor("ws-1")),
				"ws-1 key must be gone",
			).toBeNull();
			expect(
				storage.getItem(keyFor("ws-2")),
				"Removing ws-1 must not affect ws-2",
			).toBe(JSON.stringify(["two"]));
		});

		it("does not throw when the workspace has no stored tags", () => {
			const storage = createFakeStorage();
			expect(
				() => removeWorkspaceTags("missing", storage),
				"Removing a missing key must be a no-op",
			).not.toThrow();
		});
	});

	describe("locality", () => {
		it("does not make network requests", async () => {
			const originalFetch = globalThis.fetch;
			let networkCalls = 0;
			globalThis.fetch = (async () => {
				networkCalls += 1;
				return new Response("{}", { status: 200 });
			}) as typeof fetch;
			try {
				const storage = createFakeStorage();
				normalizeTags("a,b");
				isValidTags("a,b");
				formatTagsInput(["a", "b"]);
				readWorkspaceTags("ws-1", storage);
				writeWorkspaceTags("ws-1", ["a"], storage);
				removeWorkspaceTags("ws-1", storage);
				expect(
					networkCalls,
					"Workspace tag helpers must be local and must never call fetch",
				).toBe(0);
			} finally {
				globalThis.fetch = originalFetch;
			}
		});
	});
});
