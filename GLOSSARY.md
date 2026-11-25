# Glossary

The project's shared vocabulary. Keep names in code and conversation aligned with these terms; add a term when a concept gets a module of its own.

- **Update flow** — every rule that decides when the app offers a reload after a new service worker version arrives: the notice shown when a worker waits, the takeover noticed when another tab applied the update, the reload triggered by the Reload button, and the hourly/foreground update check. Lives in `src/update-flow.js` behind `createUpdateFlow`; the browser wiring stays in `src/main.js`.
- **Message** — a text key plus values, turned into text only when displayed, so it appears in the right language even after a language switch. The primitive lives in `src/messages.js` (`msg`); the error and tide-status tables map errors and tide results onto it, and `viewer.js` renders messages through the i18n store.
