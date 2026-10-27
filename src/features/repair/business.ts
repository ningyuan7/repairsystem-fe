export type Category = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "DISABLED";
  version: number;
};
export type Asset = {
  id: string;
  storeId: string;
  assetCode: string;
  name: string;
  zone: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  lifecycle: "ACTIVE" | "RETIRED";
  condition: "NORMAL" | "FAULTY" | "REPAIRING";
  replacedByAssetId: string | null;
  version: number;
};
export type Attachment = {
  id: string;
  purpose: string;
  status: string;
  size: number;
  contentType: string;
  expiresAt: string;
};
export type TicketStatus =
  | "SUBMITTED"
  | "WAITING_PROCUREMENT"
  | "READY_FOR_DISPATCH"
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "WAITING_ACCEPTANCE"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";
export type Snapshot = {
  storeName: string;
  facilityName: string;
  zone: string;
  assetCode: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
};
export type Ticket = {
  id: string;
  ticketNo: string;
  storeId: string;
  storeName: string;
  assetId: string | null;
  replacementAssetId: string | null;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  facilitySnapshot: Snapshot;
  contactName: string;
  contactPhone: string;
  priority: "NORMAL" | "URGENT";
  status: TicketStatus;
  resolutionPlan: string | null;
  procurementRequired: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  submittedAt: string;
  assignedAt: string | null;
  acceptedAt: string | null;
  firstStartedAt: string | null;
  completedAt: string | null;
  version: number;
  materialsReady: boolean;
  costStatus: string;
  allowedActions: string[];
  attachments: Attachment[];
};
export type Event = {
  id: string;
  ticketVersion: number;
  action: string;
  fromStatus: string | null;
  toStatus: TicketStatus;
  actorName: string;
  actorRole: string;
  note: string;
  payload: {
    scheduledAt: string | null;
    resultNote: string | null;
    replacementSerialNumber: string | null;
    laborSuggestedAmount: string | null;
    otherSuggestedAmount: string | null;
  };
  createdAt: string;
  attachments: Attachment[];
};
export type Events = { items: Event[]; nextCursor: string | null };
export const statusNames: Record<TicketStatus, string> = {
  SUBMITTED: "待审核",
  WAITING_PROCUREMENT: "待采购",
  READY_FOR_DISPATCH: "待派单",
  ASSIGNED: "待接单",
  ACCEPTED: "已接单",
  IN_PROGRESS: "维修中",
  WAITING_ACCEPTANCE: "待验收",
  COMPLETED: "已完成",
  CANCELLED: "已撤销",
  REJECTED: "已驳回",
};
export const actionNames: Record<string, string> = {
  purchase: "采购与材料",
  costs: "确认维修费用",
  "purchase-create": "建立采购草稿",
  "purchase-save": "保存采购草稿",
  "purchase-place": "采购已下单",
  "purchase-cancel": "取消采购记录",
  "material-receive": "登记材料到货",
  "cost-confirm": "确认维修费用",
  submit: "提交报修",
  approve: "审核通过",
  reject: "驳回报修",
  cancel: "撤销报修",
  "asset-link": "关联设施",
  assign: "安排工程师",
  reassign: "改派工程师",
  "withdraw-assignment": "撤回派单",
  accept: "确认接单",
  appointment: "预约上门",
  start: "开始维修",
  "work-records": "记录维修过程",
  "submit-result": "提交维修结果",
  confirm: "验收通过",
  return: "退回维修",
};
export const statusColors: Record<TicketStatus, string> = {
  SUBMITTED: "gold",
  WAITING_PROCUREMENT: "orange",
  READY_FOR_DISPATCH: "blue",
  ASSIGNED: "geekblue",
  ACCEPTED: "cyan",
  IN_PROGRESS: "processing",
  WAITING_ACCEPTANCE: "purple",
  COMPLETED: "success",
  CANCELLED: "default",
  REJECTED: "error",
};
export function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "—";
}
export type PurchaseItem = {
  id?: string;
  purpose: "PART" | "REPLACEMENT";
  name: string;
  brand: string | null;
  model: string | null;
  quantity: number;
  unitPrice: string;
  receivedQuantity: number;
  specConfirmed: boolean;
  sourceOcrJobId: string | null;
  sourceCandidateIndex: number | null;
};
export type PurchaseOrder = {
  id: string;
  ticketId: string;
  status: "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  version: number;
  ticketVersion: number;
  resolutionPlan: string;
  supplier: string;
  orderNumber: string | null;
  orderedAt: string | null;
  currency: "CNY";
  adjustmentAmount: string;
  confirmedTotal: string;
  receivedAt: string | null;
  items: PurchaseItem[];
  screenshots: Attachment[];
};
export type Materials = {
  ticketId: string;
  procurementRequired: boolean;
  purchaseOrderId: string | null;
  purchaseOrderVersion: number | null;
  ticketVersion: number;
  status: string;
  materialsReady: boolean;
  items: {
    id: string;
    purpose: string;
    name: string;
    brand: string | null;
    model: string | null;
    quantity: number;
    receivedQuantity: number;
  }[];
};
export type Cost = {
  ticketId: string;
  status: "PENDING" | "CONFIRMED";
  version: number | null;
  ticketVersion: number;
  purchaseAmount: string;
  laborAmount: string | null;
  otherAmount: string | null;
  totalAmount: string | null;
  note: string | null;
  confirmedAt: string | null;
};
export const purchaseStatusNames: Record<PurchaseOrder["status"], string> = {
  DRAFT: "采购草稿",
  ORDERED: "已下单 · 待到货",
  PARTIALLY_RECEIVED: "部分到货",
  RECEIVED: "已全部收齐",
  CANCELLED: "已取消",
};
export function cents(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^-?\d{1,12}(\.\d{1,2})?$/.test(value))
    return null;
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return value.startsWith("-") ? -amount : amount;
}
export function moneyText(value: bigint) {
  const positive = value < 0n ? -value : value;
  return (
    (value < 0n ? "-" : "") +
    (positive / 100n).toString() +
    "." +
    (positive % 100n).toString().padStart(2, "0")
  );
}
export function shanghaiInput(value: string | null) {
  if (!value) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function shanghaiIso(value: string) {
  return new Date(
    value + (value.length === 16 ? ":00" : "") + "+08:00",
  ).toISOString();
}
