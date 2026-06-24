import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  // Ignore generated/build files and shadcn/ui auto-generated components
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "drizzle/migrations/**",
      "*.config.ts",
      "*.config.mjs",
      "*.config.cjs",
      ".eslintrc.cjs",
      // shadcn/ui generated components — do not lint
      "client/src/components/ui/**",
      // Manus debug tooling
      "client/public/__manus__/**",
      // Third-party / Manus framework files
      "client/src/components/Map.tsx",
      "client/src/components/AIChatBox.tsx",
      "client/src/components/DashboardLayoutSkeleton.tsx",
      "client/src/components/DashboardLayout.tsx",
      "client/src/components/ManusDialog.tsx",
      "client/src/components/EventCalendar.tsx",
      "client/src/components/BenchmarkChart.tsx",
      "client/src/components/CaixaCard.tsx",
      "client/src/contexts/ThemeContext.tsx",
      "client/src/hooks/usePersistFn.ts",
      "client/src/pages/ComponentShowcase.tsx",
      "drizzle/**",
      // Utility scripts
      "scripts/**",
      // Manus framework core
      "server/_core/**",
    ],
  },
  // Base JS rules
  js.configs.recommended,
  // TypeScript rules
  ...tseslint.configs.recommended,
  // React rules
  {
    files: ["client/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "off", // TypeScript handles this
      "react-hooks/exhaustive-deps": "warn", // downgrade from error
    },
  },
  // Server rules
  {
    files: ["server/**/*.ts", "server/**/*.mjs", "shared/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "off", // TypeScript handles this
    },
  }
);
