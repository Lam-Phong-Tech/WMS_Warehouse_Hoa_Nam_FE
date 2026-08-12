export type ContainerType = "CARTON" | "BOX" | "TRAY";

export interface ContainerItemRecord {
  id: string;
  itemId?: string;
  skuId?: string;
  quantity: number;
  sourceType?: string;
  sourceId?: string;
  status: string;
}

export interface PutawayContainer {
  id: string;
  code: string;
  type: ContainerType;
  primarySkuId?: string;
  parentContainerId?: string;
  zoneCode?: string;
  locationHint?: string;
  status: string;
  version: number;
  items: ContainerItemRecord[];
  quantity: number;
}

export interface PutawayResult {
  container: PutawayContainer;
  putawayConfirmed: boolean;
  stockEffect: "NONE";
}
