export type BackendParameterKind =
  | "status"
  | "phase"
  | "action"
  | "handover"
  | "extensions"
  | "master"
  | "resource"
  | "message";

export type BackendCatalogEntry = readonly [
  source: string,
  en: string,
  zh: string,
  parameters?: Readonly<Record<string, BackendParameterKind>>,
  allowedValues?: Readonly<Record<string, ReadonlyArray<string>>>,
];
