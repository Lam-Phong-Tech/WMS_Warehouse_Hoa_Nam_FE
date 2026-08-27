/** Type declarations cho ui-guards-lib.mjs — dùng bởi src/test/ui-foundation. */
export declare const REPO_ROOT: string;
export declare function walk(
  rootAbs: string,
  exts: string[],
  options?: { exclude?: string[] },
): string[];
export declare function read(rel: string): string;
export declare function findEngineImports(content: string): string[];
export declare function findEmotionImports(content: string): string[];
export declare function hasCreateTheme(content: string): boolean;
export declare function hasThemeProviderJsx(content: string): boolean;
export declare function hasConfigProviderJsx(content: string): boolean;
export declare function findHexLiterals(content: string): string[];
export declare function findForbiddenFonts(content: string): string[];
export declare function findCssImports(content: string): string[];
export declare function countImportant(content: string): number;
export declare function looksLikeTokenSource(content: string): boolean;
export declare function loadJson(rel: string): unknown;
export declare function saveJson(rel: string, data: unknown): void;
export declare function fail(violations: string[], guardName: string): number;
