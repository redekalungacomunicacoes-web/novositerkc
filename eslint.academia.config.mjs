import { createRequire } from "node:module";
const tseslint = createRequire(import.meta.url)("typescript-eslint");
export default tseslint.config({
  files: ["src/app/pages/admin/academia/**/*.{ts,tsx}"],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
  plugins: { "@typescript-eslint": tseslint.plugin },
  rules: {
    "no-constant-condition": "error",
    "no-debugger": "error",
    "no-duplicate-case": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
});
