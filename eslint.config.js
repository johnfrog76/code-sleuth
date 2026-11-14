import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "coverage/",
      "test/fixtures/",
      ".atoms-build/",
      // The deck page is its own npm project (web/package.json), checked by its own type check. Its deck home
      // holds a copied engine and decks carried in byte for byte, which keep their own style (docs/DECK.md).
      "web/dist/",
      "web/src/deck/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // The development scripts run under Node, as plain JavaScript.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { console: "readonly", process: "readonly", URL: "readonly" } },
  },
  // The deck page's smoke test runs under Node too, and hands the browser functions that read the page.
  {
    files: ["web/tests/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        fetch: "readonly",
        document: "readonly",
        window: "readonly",
      },
    },
  },
  prettier,
);
