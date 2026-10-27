import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { api, errorText, Session } from "./api";
import { TicketAction } from "./TicketForms";
import {
  cents,
  moneyText,
  PurchaseItem,
  PurchaseOrder,
  purchaseStatusNames,
  shanghaiInput,
  shanghaiIso,
  Ticket,
} from "./business";
import { ImageField, PrivateImage } from "./PrivateImages";
import OcrPanel from "./OcrPanel";
const { Title, Text, Paragraph } = Typography;
type DraftValues = {
  supplier: string;
  orderNumber: string;
  orderedAt: string;
  adjustmentAmount: string;
  items: PurchaseItem[];
};

export default function PurchaseWorkspace({ session }: { session: Session }) {
  const location = useLocation(),
    navigate = useNavigate(),
    { message } = App.useApp();
  const id = location.pathname.match(/\/purchases\/(\d+)$/)?.[1];
  const [form] = Form.useForm<DraftValues>();
  const watchedItems: PurchaseItem[] | undefined = Form.useWatch("items", form),
    adjustment: string | undefined = Form.useWatch("adjustmentAmount", form);
  const [order, setOrder] = useState<PurchaseOrder>(),
    [ticket, setTicket] = useState<Ticket>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [uploading, setUploading] = useState(false),
    [staged, setStaged] = useState<string[]>([]);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dialog, setDialog] = useState<"place" | "cancel">(),
    [reason, setReason] = useState("");
  const populate = useCallback(
    (data: PurchaseOrder) => {
      form.setFieldsValue({
        supplier: data.supplier,
        orderNumber: data.orderNumber || "",
        orderedAt: shanghaiInput(data.orderedAt),
        adjustmentAmount: data.adjustmentAmount,
        items: data.items,
      });
      setDirty(false);
    },
    [form],
  );
  const load = useCallback(
    async (resetForm = false) => {
      if (!id) {
        setError("采购单地址无效");
        setLoading(false);
        return undefined;
      }
      setError("");
      try {
        const data = await api<PurchaseOrder>("/repair/purchase-orders/" + id);
        setOrder(data);
        setTicket(await api<Ticket>("/repair/tickets/" + data.ticketId));
        if (resetForm) populate(data);
        return data;
      } catch (err) {
        setError(errorText(err));
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [id, populate],
  );
  useEffect(() => {
    setLoading(true);
    void load(true);
  }, [load]);
  const editable = order?.status === "DRAFT";
  let total = cents(adjustment ?? "0.00");
  for (const item of watchedItems || []) {
    const amount = cents(item?.unitPrice);
    if (
      amount === null ||
      !Number.isInteger(item?.quantity) ||
      item.quantity < 1
    ) {
      total = null;
      break;
    }
    if (total !== null) total += amount * BigInt(item.quantity);
  }
  const bindImages = async () => {
    if (!order) return;
    setBusy(true);
    setError("");
    let current = order;
    try {
      for (const imageId of staged) {
        await api(`/repair/attachments/${imageId}/bind-order`, {
          method: "POST",
          body: {
            expectedVersion: current.version,
            expectedTicketVersion: current.ticketVersion,
          },
        });
        setStaged((images) => images.filter((value) => value !== imageId));
        const next = await load();
        if (!next) throw new Error("截图已绑定，请刷新采购单后继续");
        current = next;
      }
      void message.success("订单截图已绑定");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="full-state">
        <Spin />
        <p>正在读取采购记录…</p>
      </div>
    );
  if (!order || !ticket)
    return (
      <Alert
        type="error"
        showIcon
        message={error || "采购记录暂不可读"}
        action={<Button onClick={() => void load(true)}>重试</Button>}
      />
    );
  return (
    <>
      <Button
        type="link"
        className="back-link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/tickets/" + order.ticketId)}
      >
        返回报修工单
      </Button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">总部采购记录 · {ticket.ticketNo}</span>
          <Title level={2}>维修采购</Title>
          <Text type="secondary">
            核对本次采购的配件或替换设备，并跟进材料到货。
          </Text>
        </div>
        <Space wrap>
          <Tag
            color={
              editable ? "gold" : order.status === "RECEIVED" ? "green" : "blue"
            }
          >
            {purchaseStatusNames[order.status]}
          </Tag>
          <Button
            icon={<ReloadOutlined />}
            disabled={busy}
            onClick={() => void load()}
          >
            刷新版本
          </Button>
          {editable && (
            <Button
              type="primary"
              loading={busy}
              disabled={uploading}
              onClick={() => form.submit()}
            >
              保存草稿
            </Button>
          )}
        </Space>
      </div>
      {ticket.allowedActions.includes("assign") && (
        <Alert className="form-alert purchase-dispatch-ready" showIcon type="success"
          message="采购已确认下单，可以派单了"
          description="现在即可安排工程师；材料全部收齐后才能开工。"
          action={<Button type="primary" disabled={busy || uploading} onClick={() => setDispatchOpen(true)}>安排工程师</Button>} />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          className="form-alert"
          action={<Button onClick={() => void load()}>加载最新版本</Button>}
        />
      )}
      <section className="work-panel original-facility">
        <div>
          <strong>原故障设施 · {ticket.facilitySnapshot.facilityName}</strong>
          <Paragraph type="secondary">
            {ticket.storeName} · {ticket.facilitySnapshot.zone}
          </Paragraph>
        </div>
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 3 }}
          items={[
            {
              key: "brand",
              label: "原品牌",
              children: ticket.facilitySnapshot.brand || "未标注",
            },
            {
              key: "model",
              label: "原型号",
              children: ticket.facilitySnapshot.model || "未标注",
            },
            {
              key: "plan",
              label: "处理方案",
              children:
                ticket.resolutionPlan === "REPLACEMENT"
                  ? "更换设备"
                  : "配件维修",
            },
          ]}
        />
        <Paragraph className="preserve-lines">{ticket.description}</Paragraph>
      </section>
      <div className="purchase-layout">
        <section className="work-panel purchase-evidence">
          <div className="panel-heading">
            <Title level={4}>订单截图</Title>
            <Text type="secondary">订单截图与价格仅总部可见</Text>
          </div>
          <div className="panel-body">
            {!order.screenshots.length && (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="尚无订单截图，可先手动填写采购记录"
              />
            )}
            {order.screenshots.map((image) => (
              <div key={image.id} className="order-image">
                <PrivateImage id={image.id} large />
              </div>
            ))}
            {editable && (
              <>
                <Form.Item label="添加采购订单截图">
                  <ImageField
                    purpose="ORDER_SCREENSHOT"
                    purchaseOrderId={order.id}
                    ticketId={order.ticketId}
                    value={staged}
                    onChange={setStaged}
                    onBusyChange={setUploading}
                    maxFiles={Math.max(0, 6 - order.screenshots.length)}
                  />
                </Form.Item>
                {staged.length > 0 && (
                  <Button
                    loading={busy}
                    disabled={uploading}
                    onClick={() => void bindImages()}
                  >
                    绑定已上传截图（{staged.length}）
                  </Button>
                )}
              </>
            )}
            <Alert
              className="spaced"
              type="info"
              showIcon
              message="截图用于人工核对，品牌或型号没有标注时请明确填写“未标注”。"
            />
            <OcrPanel
              order={order}
              onMetadata={(data) => {
                Modal.confirm({
                  title: "应用识别订单字段",
                  content:
                    "仅将已识别的订单号、供应商、下单时间和调整额填入当前表单。请核对后再保存。",
                  okText: "应用字段",
                  cancelText: "保留当前内容",
                  onOk: () => {
                    if (data.orderNumber)
                      form.setFieldValue("orderNumber", data.orderNumber.value);
                    if (data.supplier)
                      form.setFieldValue("supplier", data.supplier.value);
                    if (data.orderedAt)
                      form.setFieldValue(
                        "orderedAt",
                        shanghaiInput(data.orderedAt.value),
                      );
                    if (data.adjustmentAmount)
                      form.setFieldValue(
                        "adjustmentAmount",
                        data.adjustmentAmount.value,
                      );
                    setDirty(true);
                  },
                });
              }}
              onItem={(jobId, index, item) => {
                const items = form.getFieldValue("items") || [];
                if (
                  items.some(
                    (row: PurchaseItem) =>
                      row.sourceOcrJobId === jobId &&
                      row.sourceCandidateIndex === index,
                  )
                ) {
                  void message.info("该候选已在当前明细中，请直接编辑");
                  return;
                }
                if (items.length >= 100) {
                  void message.error("采购明细最多100项");
                  return;
                }
                form.setFieldValue("items", [
                  ...items,
                  {
                    name: item.name?.value || "",
                    brand: item.brand?.value || "",
                    model: item.model?.value || "",
                    quantity: item.quantity?.value,
                    unitPrice: item.unitPrice?.value || "",
                    specConfirmed: false,
                    sourceOcrJobId: jobId,
                    sourceCandidateIndex: index,
                  },
                ]);
                setDirty(true);
                void message.success("候选已填入明细，请选择用途并核对规格");
              }}
            />
          </div>
        </section>
        <section className="work-panel">
          <div className="panel-heading">
            <Title level={4}>本次采购</Title>
            <Text type="secondary">
              采购规格独立保存，原故障设施快照继续保留
            </Text>
          </div>
          <div className="panel-body">
            <Form<DraftValues>
              form={form}
              layout="vertical"
              requiredMark={false}
              disabled={!editable || busy}
              onValuesChange={(changed) => {
                setDirty(true);
                if (changed.items)
                  for (let index = 0; index < changed.items.length; index++) {
                    const value = changed.items[index];
                    if (
                      value &&
                      ["brand", "model", "name", "purpose"].some((key) =>
                        Object.prototype.hasOwnProperty.call(value, key),
                      )
                    )
                      form.setFieldValue(
                        ["items", index, "specConfirmed"],
                        false,
                      );
                  }
              }}
              onFinish={async (values) => {
                setBusy(true);
                setError("");
                try {
                  await api("/repair/purchase-orders/" + order.id, {
                    method: "PUT",
                    body: {
                      expectedVersion: order.version,
                      expectedTicketVersion: order.ticketVersion,
                      supplier: values.supplier || "",
                      orderNumber: values.orderNumber || null,
                      orderedAt: values.orderedAt
                        ? shanghaiIso(values.orderedAt)
                        : null,
                      currency: "CNY",
                      adjustmentAmount: values.adjustmentAmount,
                      items: (values.items || []).map((item) => ({
                        ...(item.id ? { id: item.id } : {}),
                        purpose: item.purpose,
                        name: item.name,
                        brand: item.brand || null,
                        model: item.model || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        specConfirmed: !!item.specConfirmed,
                        sourceOcrJobId: item.sourceOcrJobId || null,
                        sourceCandidateIndex: item.sourceCandidateIndex ?? null,
                      })),
                      sourceOcrJobId: null,
                    },
                  });
                  await load(true);
                  void message.success("采购草稿已保存");
                } catch (err) {
                  setError(errorText(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Form.Item name="supplier" label="供应商" rules={[{ max: 128 }]}>
                <Input placeholder="填写实际采购渠道或供应商" />
              </Form.Item>
              <Form.Item
                name="orderNumber"
                label="外部订单号（选填）"
                rules={[{ max: 128 }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="orderedAt" label="实际下单时间（北京时间）">
                <Input type="datetime-local" />
              </Form.Item>
              <Form.List name="items">
                {(fields, { add, remove }) => (
                  <>
                    <div className="form-section-heading">
                      <strong>采购明细 · {fields.length} 项</strong>
                      {editable && (
                        <Button
                          type="link"
                          icon={<PlusOutlined />}
                          disabled={busy || fields.length >= 100}
                          onClick={() =>
                            add({
                              purpose:
                                order.resolutionPlan === "REPLACEMENT" &&
                                !fields.length
                                  ? "REPLACEMENT"
                                  : "PART",
                              name: "",
                              brand: "",
                              model: "",
                              quantity: 1,
                              unitPrice: "",
                              specConfirmed: false,
                            })
                          }
                        >
                          添加明细
                        </Button>
                      )}
                    </div>
                    {!fields.length && (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="添加本次实际采购的物品"
                      />
                    )}
                    {fields.map((field, index) => (
                      <div className="purchase-item" key={field.key}>
                        <div className="form-section-heading">
                          <strong>明细 {index + 1}</strong>
                          {editable && (
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              aria-label={"移除采购明细 " + (index + 1)}
                              onClick={() => remove(field.name)}
                            />
                          )}
                        </div>
                        <Form.Item name={[field.name, "id"]} hidden>
                          <Input />
                        </Form.Item>
                        <div className="form-two-columns">
                          <Form.Item
                            name={[field.name, "purpose"]}
                            label="物品用途"
                            rules={[{ required: true }]}
                          >
                            <Select
                              options={[
                                { value: "PART", label: "维修配件" },
                                ...(order.resolutionPlan === "REPLACEMENT"
                                  ? [
                                      {
                                        value: "REPLACEMENT",
                                        label: "替换设备",
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, "name"]}
                            label="物品名称"
                            rules={[
                              { required: true, whitespace: true, max: 128 },
                            ]}
                          >
                            <Input />
                          </Form.Item>
                        </div>
                        <div className="form-two-columns">
                          <Form.Item
                            name={[field.name, "brand"]}
                            label="采购品牌"
                            rules={[{ max: 128 }]}
                          >
                            <Input placeholder="未知请填“未标注”" />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, "model"]}
                            label="采购型号"
                            rules={[{ max: 128 }]}
                          >
                            <Input placeholder="未知请填“未标注”" />
                          </Form.Item>
                        </div>
                        <div className="form-two-columns">
                          <Form.Item
                            name={[field.name, "quantity"]}
                            label="采购数量"
                            rules={[
                              {
                                required: true,
                                type: "number",
                                min: 1,
                                max: 999,
                              },
                            ]}
                          >
                            <InputNumber
                              min={1}
                              max={999}
                              precision={0}
                              style={{ width: "100%" }}
                            />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, "unitPrice"]}
                            label="采购单价（元）"
                            rules={[
                              {
                                required: true,
                                pattern: /^\d{1,10}(\.\d{1,2})?$/,
                                message: "输入最多两位小数的非负金额",
                              },
                            ]}
                          >
                            <Input inputMode="decimal" />
                          </Form.Item>
                        </div>
                        <Form.Item
                          name={[field.name, "specConfirmed"]}
                          valuePropName="checked"
                        >
                          <Checkbox>已人工核对本项物品的品牌和型号</Checkbox>
                        </Form.Item>
                      </div>
                    ))}
                  </>
                )}
              </Form.List>
              <Form.Item
                name="adjustmentAmount"
                label="调整额：运费填正数、折扣填负数（元）"
                rules={[
                  {
                    required: true,
                    pattern: /^-?\d{1,12}(\.\d{1,2})?$/,
                    message: "请输入最多两位小数的金额",
                  },
                ]}
              >
                <Input inputMode="decimal" />
              </Form.Item>
              <div className="purchase-total">
                <span>{editable ? "草稿合计" : "已确认采购合计"}</span>
                <strong>
                  ¥{" "}
                  {editable
                    ? total === null
                      ? "待补齐"
                      : moneyText(total)
                    : order.confirmedTotal}
                </strong>
              </div>
              {editable && (
                <Paragraph type="secondary">
                  每条明细确认规格、补齐供应商和下单时间后，再确认“已下单”。
                </Paragraph>
              )}
            </Form>
            <Space wrap className="spaced">
              {editable && (
                <Button
                  type="primary"
                  disabled={
                    dirty ||
                    busy ||
                    uploading ||
                    !order.items.length ||
                    staged.length > 0
                  }
                  onClick={() => setDialog("place")}
                >
                  确认已下单
                </Button>
              )}
              {((order.status === "DRAFT" &&
                ticket.status === "WAITING_PROCUREMENT") ||
                (order.status === "ORDERED" &&
                  ticket.status === "READY_FOR_DISPATCH")) && (
                <Button
                  danger
                  disabled={busy}
                  onClick={() => {
                    setReason("");
                    setDialog("cancel");
                  }}
                >
                  取消采购记录
                </Button>
              )}
              <Button onClick={() => navigate("/tickets/" + order.ticketId)}>
                查看派单与到货
              </Button>
            </Space>
            {dirty && (
              <Paragraph type="secondary" className="spaced">
                有未保存的修改，请先保存草稿。
              </Paragraph>
            )}
          </div>
        </section>
      </div>
      {dispatchOpen && <TicketAction ticket={ticket} action="assign" session={session}
        onClose={() => setDispatchOpen(false)} onReload={async () => { await load(); }} onDone={async () => { await load(); }} />}
      <Modal
        open={!!dialog}
        title={dialog === "place" ? "确认采购已下单" : "取消采购记录"}
        confirmLoading={busy}
        onCancel={() => !busy && setDialog(undefined)}
        okText="确认操作"
        onOk={async () => {
          if (dialog === "cancel" && !reason.trim()) {
            setError("请填写取消原因");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await api(`/repair/purchase-orders/${order.id}/${dialog}`, {
              method: "POST",
              body: {
                expectedVersion: order.version,
                expectedTicketVersion: order.ticketVersion,
                ...(dialog === "cancel" ? { reason } : {}),
              },
            });
            setDialog(undefined);
            await load(true);
            void message.success(
              dialog === "place"
                ? "下单记录已确认，可以安排工程师"
                : "采购记录已取消",
            );
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <Alert type="error" showIcon message={error} className="form-alert" />
        )}
        {dialog === "place" ? (
          <>
            <Paragraph>
              请先完成实际采购，再确认本次记录。确认后将冻结采购明细。
            </Paragraph>
            <Paragraph>
              <strong>采购合计：¥ {order.confirmedTotal}</strong>
            </Paragraph>
          </>
        ) : (
          <>
            <Paragraph>
              仅支持尚未到货、尚未派单的采购记录。原记录将保留。
            </Paragraph>
            <Input.TextArea
              aria-label="取消采购原因"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </>
        )}
      </Modal>
    </>
  );
}
