import { Alert, Button, Space, Steps } from "antd";
import { Ticket } from "./business";

export function nextStep(ticket: Ticket): { title: string; detail: string; action?: string; label?: string } {
  switch (ticket.status) {
    case "SUBMITTED": return { title: "先审核报修，明确是否需要采购", detail: "请选择直接维修、采购配件后维修或采购设备并替换。需要采购的工单，审核后填写订购信息。", action: "approve", label: "审核报修" };
    case "WAITING_PROCUREMENT": return { title: "填写本次维修的订购信息", detail: "录入供应商、实际下单时间及物品名称、品牌、型号、数量、单价；可上传订单截图辅助识别。保存草稿并确认已下单后，即可派单，无需等待材料到齐。", action: "purchase", label: "填写订购信息" };
    case "READY_FOR_DISPATCH": return { title: "可以安排维修工程师", detail: ticket.procurementRequired ? "采购已确认下单，现在可以安排工程师。材料全部到货后，工程师才能开工。" : "本次审核选择了直接维修，无需填写采购单，可以直接安排工程师。", action: "assign", label: "去派单" };
    case "ASSIGNED": return { title: "等待工程师接单", detail: "已完成派单，请跟进工程师接单；需要调整时可先撤回派单。" };
    case "ACCEPTED": return { title: ticket.materialsReady ? "工程师已接单，等待开工" : "工程师已接单，等待材料到齐", detail: ticket.materialsReady ? "材料条件已满足，由工程师安排上门并开始维修。" : "门店登记材料到货后，工程师才能开始维修。" };
    case "IN_PROGRESS": return { title: "工程师正在维修", detail: "维修记录、材料到货和后续验收都在当前工单持续跟进。" };
    case "WAITING_ACCEPTANCE": return { title: "维修完成，等待验收", detail: "门店确认维修结果；总部可按现有规则代验收并核对费用。" };
    default: return { title: "本次工单已结束", detail: "可在处理记录中查阅报修、采购、派单和验收经过。" };
  }
}
export default function TicketNextStep({ ticket, busy, onAction }: { ticket: Ticket; busy: boolean; onAction: (action: string) => void }) {
  const next = nextStep(ticket);
  const terminal = ["COMPLETED", "CANCELLED", "REJECTED"].includes(ticket.status);
  const current = ticket.status === "SUBMITTED" ? 0 : ticket.status === "WAITING_PROCUREMENT" ? 1 : ticket.status === "READY_FOR_DISPATCH" ? 2 : ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(ticket.status) ? 3 : 4;
  const actionable = !!next.action && ticket.allowedActions.includes(next.action);
  return (
    <section className="ticket-next-step" aria-label="工单下一步">
      <Steps size="small" current={current} status={terminal ? (ticket.status === "COMPLETED" ? "finish" : "error") : "process"} responsive items={[
        { title: "审核" }, { title: ticket.status !== "SUBMITTED" && !ticket.procurementRequired ? "无需采购" : "订购信息" }, { title: "派单" }, { title: "维修" }, { title: "验收" },
      ]} />
      <Alert showIcon type="info" message={next.title} description={next.detail}
        action={actionable ? <Space><Button type="primary" loading={busy} onClick={() => onAction(next.action!)}>{next.label}</Button></Space> : undefined} />
    </section>
  );
}
