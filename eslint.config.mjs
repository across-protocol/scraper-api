import typescriptESLintplugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      typescriptESLintplugin: typescriptESLintplugin,
    },
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": "off",
      "no-extra-boolean-cast": "off",
    },
    files: ["src/**/*.ts"],
  },
  {
    ignores: ["dist/"],
  },
  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@stylistic/max-len": [
        "warn",
        {
          code: 120,
          ignoreComments: true,
          ignoreTemplateLiterals: true,
          ignoreStrings: true,
        },
      ],
      "@stylistic/comma-dangle": ["error", "always-multiline"],
    },
  },
];
