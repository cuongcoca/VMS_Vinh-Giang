import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Phase 6.1 — UI guardrails: chặn alert/confirm/prompt browser-native
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='alert']",
          message: "Không dùng alert(). Dùng useToast() từ @/components/ui.",
        },
        {
          selector: "CallExpression[callee.name='confirm']",
          message: "Không dùng confirm(). Dùng useConfirm() từ @/components/ui.",
        },
        {
          selector: "CallExpression[callee.name='prompt']",
          message: "Không dùng prompt(). Tạo custom modal với <Input>.",
        },
      ],
    },
  },

  // Phase 3.2 — Cấm import AppLayout vào mobile pages (xenang/thukho/kiemke/forklift mobile)
  {
    files: [
      "src/app/forklift/**/*.tsx",
      "src/app/thukho/**/*.tsx",
      "src/app/kiemke/**/*.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/layout/AppLayout",
              message:
                "Mobile page KHÔNG dùng AppLayout (layout đã có sẵn từ {role}/layout.tsx). Bỏ wrap để tránh NESTED LAYOUT bug.",
            },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Phase 6: ignore codemod scripts (run-once tools)
    "scripts/**",
  ]),
]);

export default eslintConfig;
