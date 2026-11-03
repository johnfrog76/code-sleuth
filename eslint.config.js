import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "test/fixtures/", ".atoms-build/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // The development scripts run under Node, as plain JavaScript.
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { console: "readonly", process: "readonly", URL: "readonly" } },
  },
  prettier,
);
