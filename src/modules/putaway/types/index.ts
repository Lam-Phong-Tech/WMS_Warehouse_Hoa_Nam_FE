export interface PutawayTask {
  id: string;
  boxCode: string;
  sku: string;
  skuName: string;
  quantity: number;
  receiptCode: string;
  status: "RECEIVED_PENDING_PUTAWAY" | "STORED";
  locationHint: string;
  age: string;
  trayCode?: string;
}

export interface PutawayConfirm {
  boxCode: string;
  trayCode: string;
  locationHint: string;
}

export interface PutawayHistory {
  id: string;
  time: string;
  boxCode: string;
  oldTray: string | null;
  newTray: string;
  locationHint: string;
  actor: string;
}
