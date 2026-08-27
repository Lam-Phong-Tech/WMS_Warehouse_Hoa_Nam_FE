import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Permission system chỉ có 2 public entry point hợp lệ:
// - '@/shared/components/permission' — component-level guard (PermissionGuard,
//   ActionButton, Can, usePermission, canAction, ...)
// - '@/lib/permissions' — route-level guard (RequirePermission, ProtectedRoute)
//   và data-scope theo context (useDataScope)
// Các file bên dưới TỰ triển khai permission system nên được phép import
// trực tiếp; mọi nơi khác phải import qua 2 barrel trên (xem P2.1 review).
const PERMISSION_INTERNAL_FILES = [
  'src/shared/components/permission/**',
  // ActionButton chuan (nut hanh dong toan du an) tu kiem tra quyen + scope nen
  // duoc phep dung truc tiep util permission, giong cac file permission-internal.
  'src/shared/components/actions/**',
  'src/shared/hooks/usePermission.ts',
  'src/modules/auth/utils/permission.ts',
  'src/modules/auth/components/Can.tsx',
  'src/app/router/RequirePermission.tsx',
  'src/app/router/ProtectedRoute.tsx',
  'src/lib/permissions/**',
  'src/shared/components/feedback/ActionDropdown.tsx',
  'src/shared/types/permission.scope.ts',
  'src/shared/types/permission.ts',
];

// Part 2 Vuexy sync — biên giới design system (đi kèm ratchet script
// `yarn ui:architecture|ui:tokens|ui:styles`, xem docs/ui/vuexy-sync/13):
// @emotion/* chỉ là engine nội bộ của MUI; design-tokens (hệ warm) đã retire.
const RESTRICTED_UI_PATHS = [
  {
    name: '@emotion/react',
    message:
      'Không import @emotion/* trực tiếp — chỉ là styled-engine nội bộ của MUI. Dùng sx/theme qua @/shared/ui.',
  },
  {
    name: '@emotion/styled',
    message:
      'Không import @emotion/* trực tiếp — chỉ là styled-engine nội bộ của MUI. Dùng sx/theme qua @/shared/ui.',
  },
  {
    name: '@/shared/design-tokens',
    message:
      'Nguồn token warm đã retire (DEC-UI-BASELINE-01) — dùng @/shared/ui/tokens.',
  },
];

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Cho phép destructuring bỏ field bằng tên `_...` (ví dụ loại page/per_page
      // khỏi payload export) nhưng vẫn giữ no-unused-vars ở mức error cho mọi tên khác.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Rule mới của react-hooks v7. Các màn legacy (IAM/Inbound/MasterData/
      // Putaway/CameraScan) còn 10 vị trí setState-sync-trong-effect; hạ xuống
      // warn để giữ nợ hiển thị thay vì chặn CI — refactor dần theo module.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: PERMISSION_INTERNAL_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/shared/hooks/usePermission',
              message:
                "Không import trực tiếp — dùng '@/shared/components/permission' (public API).",
            },
            {
              name: '@/modules/auth/utils/permission',
              message:
                "Không import trực tiếp — dùng '@/shared/components/permission' hoặc '@/lib/permissions'.",
            },
            ...RESTRICTED_UI_PATHS,
          ],
        },
      ],
    },
  },
  {
    // Các file permission-internal vẫn phải tuân biên giới design system.
    files: PERMISSION_INTERNAL_FILES,
    rules: {
      'no-restricted-imports': ['error', { paths: RESTRICTED_UI_PATHS }],
    },
  },
])
