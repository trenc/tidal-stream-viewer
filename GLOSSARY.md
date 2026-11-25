# Glossary

The project's shared vocabulary. Keep names in code and conversation aligned with these terms; add a term when a concept gets a module of its own.

- **Update flow** — every rule that decides when the app offers a reload after a new service worker version arrives: the notice shown when a worker waits, the takeover noticed when another tab applied the update, the reload triggered by the Reload button, and the hourly/foreground update check. Lives in `src/update-flow.js` behind `createUpdateFlow`; the browser wiring stays in `src/main.js`.
