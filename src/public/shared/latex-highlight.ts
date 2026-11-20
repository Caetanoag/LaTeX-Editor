export type HighlightTokenType =
	| "text"
	| "command"
	| "brace"
	| "environment"
	| "comment"
	| "math"
	| "special";

export type HighlightToken = {
	type: HighlightTokenType;
	value: string;
};

const SPECIAL_CHARACTERS = new Set(["&", "_", "#", "~", "^"]);
const COMMAND_CHARACTER = /[A-Za-z@]/;

const findClosing = (
	source: string,
	start: number,
	delimiter: string,
): number => {
	for (let index = start + delimiter.length; index < source.length; index++) {
		if (source[index] === "\\") {
			index++;
			continue;
		}
		if (source.startsWith(delimiter, index)) return index;
	}
	return -1;
};

export const highlightLatex = (source: string): HighlightToken[] => {
	const tokens: HighlightToken[] = [];
	let pendingText = "";

	const push = (type: HighlightTokenType, value: string): void => {
		if (value === "") return;
		const last = tokens[tokens.length - 1];
		if (last?.type === type) last.value += value;
		else tokens.push({ type, value });
	};

	const flushText = (): void => {
		push("text", pendingText);
		pendingText = "";
	};

	let index = 0;
	while (index < source.length) {
		const char = source[index];

		if (char === "%") {
			flushText();
			const lineEnd = source.indexOf("\n", index);
			const stop = lineEnd === -1 ? source.length : lineEnd;
			push("comment", source.slice(index, stop));
			index = stop;
			continue;
		}

		if (char === "\\") {
			flushText();
			const next = source[index + 1];
			if (next && COMMAND_CHARACTER.test(next)) {
				let end = index + 1;
				while (end < source.length && COMMAND_CHARACTER.test(source[end])) {
					end++;
				}
				const command = source.slice(index, end);
				push("command", command);
				index = end;

				if (
					(command === "\\begin" || command === "\\end") &&
					source[index] === "{"
				) {
					const close = source.indexOf("}", index + 1);
					if (close > index + 1) {
						push("brace", "{");
						push("environment", source.slice(index + 1, close));
						push("brace", "}");
						index = close + 1;
					}
				}
				continue;
			}

			if (next) {
				push("command", source.slice(index, index + 2));
				index += 2;
			} else {
				push("command", char);
				index++;
			}
			continue;
		}

		if (char === "{" || char === "}") {
			flushText();
			push("brace", char);
			index++;
			continue;
		}

		if (char === "$") {
			const delimiter = source[index + 1] === "$" ? "$$" : "$";
			const close = findClosing(source, index, delimiter);
			flushText();
			if (close === -1) {
				push("special", char);
				index++;
			} else {
				push("math", source.slice(index, close + delimiter.length));
				index = close + delimiter.length;
			}
			continue;
		}

		if (SPECIAL_CHARACTERS.has(char)) {
			flushText();
			push("special", char);
			index++;
			continue;
		}

		pendingText += char;
		index++;
	}

	flushText();
	return tokens;
};
