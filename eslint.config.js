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
          ],
        },
      ],
    },
  },
])
