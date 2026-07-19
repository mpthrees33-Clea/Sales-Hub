import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // jsonb payloads and evidence refs are structurally typed at the edges via Zod;
      // internal plumbing keeps `any` out of exported APIs (enforced in review).
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  { ignores: [".next/**", "node_modules/**", "var/**"] },
];

export default eslintConfig;
