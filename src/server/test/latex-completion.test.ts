import { describe, expect, it } from "bun:test";
import {
	applyCompletion,
	type CompletionContext,
	findCompletionContext,
	getSuggestions,
	shiftStops,
} from "../../public/shared/latex-completion";
import { macros } from "../../public/shared/latex-macros";

const requireContext = (
	value: string,
	caret = value.length,
): CompletionContext => {
	const context = findCompletionContext(value, caret);
	if (!context) throw new Error("Expected a completion context");
	return context;
};

const requireSuggestion = (context: CompletionContext, text: string) => {
	const suggestion = getSuggestions(context, macros).find(
		(item) => item.text === text,
	);
	if (!suggestion) throw new Error(`Expected a suggestion for ${text}`);
	return suggestion;
};

describe("LaTeX completion", () => {
	describe("findCompletionContext", () => {
		it("detects a command after a backslash", () => {
			const value = "Hello \\sec";
			expect(findCompletionContext(value, value.length)).toEqual({
				start: 6,
				end: 10,
				query: "sec",
				kind: "command",
			});
		});

		it("detects an empty command right after a backslash", () => {
			expect(findCompletionContext("\\", 1)).toEqual({
				start: 0,
				end: 1,
				query: "",
				kind: "command",
			});
		});

		it("detects environment names inside begin and end braces", () => {
			const begin = "\\begin{ite";
			expect(findCompletionContext(begin, begin.length)).toEqual({
				start: 0,
				end: begin.length,
				query: "ite",
				kind: "begin",
			});

			const end = "text \\end{item";
			expect(findCompletionContext(end, end.length)).toMatchObject({
				start: 5,
				query: "item",
				kind: "end",
			});
		});

		it("ignores escaped backslashes and plain text", () => {
			const escaped = "\\\\sec";
			expect(findCompletionContext(escaped, escaped.length)).toBeNull();
			expect(findCompletionContext("\\section{title} plain", 21)).toBeNull();
		});
	});

	describe("getSuggestions", () => {
		it("filters command macros by prefix", () => {
			const suggestions = getSuggestions(requireContext("\\sec"), macros);
			expect(suggestions.some((item) => item.text === "\\section{#1}")).toBe(
				true,
			);
			expect(suggestions.some((item) => item.text === "\\usepackage{#1}")).toBe(
				false,
			);
		});

		it("suggests environment names for begin and end contexts", () => {
			expect(
				getSuggestions(requireContext("\\begin{ite"), macros).some(
					(item) => item.text === "\\begin{itemize}",
				),
			).toBe(true);
			expect(
				getSuggestions(requireContext("\\end{ite"), macros).some(
					(item) => item.text === "\\end{itemize}",
				),
			).toBe(true);
		});

		it("limits the number of suggestions", () => {
			expect(
				getSuggestions(requireContext("\\"), macros).length,
			).toBeLessThanOrEqual(10);
		});
	});

	describe("applyCompletion", () => {
		it("replaces the typed prefix and leaves a caret at the placeholder", () => {
			const value = "\\textb";
			const context = requireContext(value);
			const suggestion = requireSuggestion(context, "\\textbf{#1}");
			const result = applyCompletion(value, context, suggestion);

			expect(result.value).toBe("\\textbf{}");
			expect(result.stops).toEqual([result.value.indexOf("}")]);
		});

		it("expands multi-placeholder snippets without leaving markers", () => {
			const value = "\\begin{figure";
			const context = requireContext(value);
			const suggestion = requireSuggestion(context, "\\begin{figure}");
			const result = applyCompletion(value, context, suggestion);

			expect(result.value).not.toContain("#");
			expect(result.value).toContain("\\includegraphics{}");
			expect(result.value).toContain("\\caption{}");
			expect(result.value).toContain("\\end{figure}");
			expect(result.stops.length).toBe(3);
		});
	});

	describe("shiftStops", () => {
		it("moves stops at or after an edit, leaving earlier ones alone", () => {
			expect(shiftStops([10, 20], 8, 3)).toEqual([13, 23]);
			expect(shiftStops([10, 20], 12, 2)).toEqual([10, 22]);
		});
	});

	it("keeps the full historical catalog and adds document commands", () => {
		const texts = macros.map((item) => item.text);
		expect(macros.length).toBeGreaterThanOrEqual(683);
		expect(new Set(texts).size).toBe(texts.length);
		expect(
			macros.every(
				(item) => item.text.startsWith("\\") && item.snippet.length > 0,
			),
		).toBe(true);
		expect(texts).toContain("\\alpha");
		expect(texts).toContain("\\begin{vmatrix}");
		expect(texts).toContain("\\section{#1}");
		expect(texts).toContain("\\begin{itemize}");
	});
});
