import type { LatexMacro } from "./latex-macros";

export type CompletionKind = "command" | "begin" | "end";

export type CompletionContext = {
	start: number;
	end: number;
	query: string;
	kind: CompletionKind;
};

export type Suggestion = {
	text: string;
	snippet: string;
};

export type AppliedCompletion = {
	value: string;
	stops: number[];
};

const MAX_SUGGESTIONS = 10;
const ESCAPED_BACKSLASH = "\\";

const isEscaped = (value: string, index: number): boolean =>
	index > 0 && value[index - 1] === ESCAPED_BACKSLASH;

const environmentName = (text: string): string =>
	/^\\begin\{([^}]+)\}$/.exec(text)?.[1] ?? "";

const sortAndLimit = (items: Suggestion[]): Suggestion[] =>
	items
		.sort(
			(left, right) =>
				left.text.length - right.text.length ||
				left.text.localeCompare(right.text),
		)
		.slice(0, MAX_SUGGESTIONS);

export const findCompletionContext = (
	value: string,
	caret: number,
): CompletionContext | null => {
	const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
	const prefix = value.slice(lineStart, caret);

	const begin = /\\begin\{([A-Za-z*]*)$/.exec(prefix);
	if (begin) {
		const start = lineStart + begin.index;
		if (!isEscaped(value, start)) {
			return {
				start,
				end: caret,
				query: begin[1] ?? "",
				kind: "begin",
			};
		}
	}

	const end = /\\end\{([A-Za-z*]*)$/.exec(prefix);
	if (end) {
		const start = lineStart + end.index;
		if (!isEscaped(value, start)) {
			return {
				start,
				end: caret,
				query: end[1] ?? "",
				kind: "end",
			};
		}
	}

	const command = /\\([A-Za-z]*)$/.exec(prefix);
	if (command) {
		const start = lineStart + command.index;
		if (!isEscaped(value, start)) {
			return {
				start,
				end: caret,
				query: command[1] ?? "",
				kind: "command",
			};
		}
	}

	return null;
};

export const getSuggestions = (
	context: CompletionContext,
	macros: readonly LatexMacro[],
): Suggestion[] => {
	const begins = macros.filter((macro) => environmentName(macro.text) !== "");

	if (context.kind === "begin") {
		return sortAndLimit(
			begins
				.filter((macro) =>
					environmentName(macro.text).startsWith(context.query),
				)
				.map((macro) => ({ text: macro.text, snippet: macro.snippet })),
		);
	}

	if (context.kind === "end") {
		return sortAndLimit(
			begins
				.map((macro) => {
					const name = environmentName(macro.text);
					return { text: `\\end{${name}}`, snippet: `\\end{${name}}` };
				})
				.filter((item) =>
					environmentName(item.text.replace("\\end", "\\begin")).startsWith(
						context.query,
					),
				),
		);
	}

	return sortAndLimit(
		macros
			.filter((macro) => macro.text.startsWith(`\\${context.query}`))
			.map((macro) => ({ text: macro.text, snippet: macro.snippet })),
	);
};

type SnippetPart =
	| { type: "text"; value: string }
	| { type: "stop"; index: number };

const parseSnippet = (snippet: string): SnippetPart[] => {
	const parts: SnippetPart[] = [];
	const placeholder = /#([1-9])/g;
	let lastIndex = 0;
	let match = placeholder.exec(snippet);

	while (match) {
		if (match.index > lastIndex) {
			parts.push({
				type: "text",
				value: snippet.slice(lastIndex, match.index),
			});
		}
		parts.push({ type: "stop", index: Number(match[1]) });
		lastIndex = placeholder.lastIndex;
		match = placeholder.exec(snippet);
	}

	if (lastIndex < snippet.length) {
		parts.push({ type: "text", value: snippet.slice(lastIndex) });
	}

	return parts;
};

export const applyCompletion = (
	value: string,
	context: CompletionContext,
	suggestion: Suggestion,
): AppliedCompletion => {
	const prefix = value.slice(0, context.start);
	const firstOffsets = new Map<number, number>();
	let inserted = "";

	for (const part of parseSnippet(suggestion.snippet)) {
		if (part.type === "text") {
			inserted += part.value;
			continue;
		}
		if (!firstOffsets.has(part.index)) {
			firstOffsets.set(part.index, inserted.length);
		}
	}

	const stops = [...firstOffsets.entries()]
		.sort((left, right) => left[0] - right[0])
		.map(([, offset]) => prefix.length + offset);

	return {
		value: `${prefix}${inserted}${value.slice(context.end)}`,
		stops,
	};
};

export const shiftStops = (
	stops: readonly number[],
	caret: number,
	delta: number,
): number[] => stops.map((stop) => (stop >= caret ? stop + delta : stop));
