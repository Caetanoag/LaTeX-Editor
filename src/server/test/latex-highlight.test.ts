import { describe, expect, it } from "bun:test";
import { highlightLatex } from "../../public/shared/latex-highlight";

describe("LaTeX syntax highlighting", () => {
	it("tokenizes commands, braces and escaped characters", () => {
		expect(highlightLatex("\\section{Title} 50\\%")).toEqual([
			{ type: "command", value: "\\section" },
			{ type: "brace", value: "{" },
			{ type: "text", value: "Title" },
			{ type: "brace", value: "}" },
			{ type: "text", value: " 50" },
			{ type: "command", value: "\\%" },
		]);
	});

	it("tokenizes comments until the end of the line", () => {
		expect(highlightLatex("text % note\nnext")).toEqual([
			{ type: "text", value: "text " },
			{ type: "comment", value: "% note" },
			{ type: "text", value: "\nnext" },
		]);
	});

	it("highlights environment names separately", () => {
		expect(highlightLatex("\\begin{itemize}\\end{itemize}")).toEqual([
			{ type: "command", value: "\\begin" },
			{ type: "brace", value: "{" },
			{ type: "environment", value: "itemize" },
			{ type: "brace", value: "}" },
			{ type: "command", value: "\\end" },
			{ type: "brace", value: "{" },
			{ type: "environment", value: "itemize" },
			{ type: "brace", value: "}" },
		]);
	});

	it("tokenizes inline and display math", () => {
		expect(highlightLatex("$x^2$ and $$y$$")).toEqual([
			{ type: "math", value: "$x^2$" },
			{ type: "text", value: " and " },
			{ type: "math", value: "$$y$$" },
		]);
	});

	it("tokenizes special characters and keeps escapes as commands", () => {
		expect(highlightLatex("a_b & c\\#d")).toEqual([
			{ type: "text", value: "a" },
			{ type: "special", value: "_" },
			{ type: "text", value: "b " },
			{ type: "special", value: "&" },
			{ type: "text", value: " c" },
			{ type: "command", value: "\\#" },
			{ type: "text", value: "d" },
		]);
	});

	it("treats an unmatched dollar sign as a special character", () => {
		expect(highlightLatex("cost $5")).toEqual([
			{ type: "text", value: "cost " },
			{ type: "special", value: "$" },
			{ type: "text", value: "5" },
		]);
	});

	it("preserves the original source when tokens are joined", () => {
		const source =
			"\\documentclass{article}\n% intro\n\\begin{document}\nHello, $x_1$! \\textbf{bold}\n\\end{document}\n";
		const tokens = highlightLatex(source);
		expect(tokens.map((token) => token.value).join("")).toBe(source);
	});
});
