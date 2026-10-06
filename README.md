# LaTeX-Editor
Self hosted opensource LaTeX editor built with TypeScript

## Key Features
- **Browser-based:** Start a web-server to run it locally.
- **WebAssembly Compiler (Odin):** The compiler is written using Odinlang and transpiled to WebAssembly, for efficiency.
- **Multi-user application:** Support for multiple user or profiles.
- **Local PostgreSQL Database and Cache system using Redis:**  Save sessions after closing the program.

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** TypeScript, Express.js
- **Build and Runtime:** Bun
- **LaTeX Compiler:** OdinLang -> WebAssembly
- **Bundle System:** Docker
- **Cache and Database:** PostgreSQL, Redis
