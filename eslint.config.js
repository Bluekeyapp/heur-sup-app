import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "_site/"]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: globals.browser
    }
  },
  {
    files: ["sw.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: globals.serviceworker
    }
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.mjs", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: globals.node
    }
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-var": "error"
    }
  }
];
