import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { api, errorText, Session } from "./api";
import { Cost, Materials, Ticket } from "./business";
import { ImageField } from "./PrivateImages";
const { Title, Text, Paragraph } = Typography;

export function MaterialsPanel({
  ticket,
  onChanged,
}: {
  ticket: Ticket;
  onChanged: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [materials, setMaterials] = useState<Materials>(),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const load = useCallback(async () => {
    setError("");
    try {
      setMaterials(
        await api<Materials>(`/repair/tickets/${ticket.id}/materials`),
      );
    } catch (err) {
      setError(errorText(err));
    }
  }, [ticket.id, ticket.version]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!ticket.procurementRequired) return null;
  return (
    <section className="materials-panel">
      <div className="form-section-heading">
        <Title level={5}>维修材料</Title>
        {materials && (
          <Tag color={materials.materialsReady ? "green" : "gold"}>
            {materials.materialsReady
              ? "材料已收齐"
              : materials.status === "WAITING_ORDER"
                ? "总部采购中"
                : "等待到货"}
          </Tag>
        )}
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={<Button onClick={() => void load()}>重试</Button>}
        />
      )}
      {!materials && !error ? (
        <Spin />
      ) : (
        materials && (
          <>
            {materials.items.length > 0 ? (
              <Table
                size="small"
                rowKey="id"
                dataSource={materials.items}
                pagination={false}
                scroll={{ x: 470 }}
                columns={[
                  {
                    title: "物品",
                    key: "name",
                    render: (_, row) => (
                      <div>
                        {row.name}
                        <div className="secondary">
                          {[row.brand, row.model].filter(Boolean).join(" / ") ||
                            "规格未标注"}
                        </div>
                      </div>
                    ),
                  },
                  { title: "采购数量", dataIndex: "quantity", width: 90 },
                  {
                    title: "已收数量",
                    dataIndex: "receivedQuantity",
                    width: 90,
                  },
                ]}
              />
            ) : (
              <Paragraph type="secondary">
                总部正在记录采购，确认下单后会显示材料与到货进度。
              </Paragraph>
            )}
            {!materials.materialsReady &&
              materials.purchaseOrderId &&
              ["ORDERED", "PARTIALLY_RECEIVED"].includes(materials.status) && (
                <>
                  <Alert
                    type="info"
                    className="spaced"
                    message="工程师可先接单预约，材料全部收齐后才能开工。"
                  />
                  <Button
                    className="spaced"
                    onClick={() => {
                      form.resetFields();
                      form.setFieldsValue({
                        items: materials.items.map((item) => ({
                          id: item.id,
                          quantity: 0,
                        })),
                        note: "",
                        attachmentIds: [],
                      });
                      setOpen(true);
                    }}
                  >
                    登记材料到货
                  </Button>
                </>
              )}
          </>
        )
      )}
      <Modal
        open={open}
        title="登记材料到货"
        width={620}
        confirmLoading={busy}
        okText="确认收货"
        okButtonProps={{ disabled: uploading }}
        onCancel={() => !busy && !uploading && setOpen(false)}
        onOk={() => form.submit()}
      >
        <Paragraph type="secondary">
          只填写本次新增收到的数量。已收记录将保留，不能用负数冲销。
        </Paragraph>
        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            className="form-alert"
            action={
              <Button
                onClick={async () => {
                  await onChanged();
                  await load();
                }}
              >
                刷新版本
              </Button>
            }
          />
        )}
        <Form
          form={form}
          layout="vertical"
          disabled={busy}
          requiredMark={false}
          onFinish={async (values) => {
            if (!materials?.purchaseOrderId) return;
            const items = (values.items || [])
              .filter((row: { quantity: number }) => row.quantity > 0)
              .map((row: { id: string; quantity: number }) => ({
                purchaseItemId: row.id,
                quantity: row.quantity,
              }));
            if (!items.length) {
              setError("至少填写一项本次实际到货数量");
              return;
            }
            setBusy(true);
            setError("");
            try {
              await api(
                `/repair/purchase-orders/${materials.purchaseOrderId}/receipts`,
                {
                  method: "POST",
                  body: {
                    expectedVersion: materials.purchaseOrderVersion,
                    expectedTicketVersion: materials.ticketVersion,
                    items,
                    note: values.note || "",
                    attachmentIds: values.attachmentIds || [],
                  },
                },
              );
              setOpen(false);
              void message.success("到货数量已登记");
              await onChanged();
              await load();
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.List name="items">
            {(fields) =>
              fields.map((field, index) => {
                const item = materials?.items[index];
                return (
                  item && (
                    <div className="receipt-row" key={field.key}>
                      <div>
                        <strong>{item.name}</strong>
                        <div className="secondary">
                          已收 {item.receivedQuantity} / {item.quantity}，待收{" "}
                          {item.quantity - item.receivedQuantity}
                        </div>
                      </div>
                      <Form.Item name={[field.name, "id"]} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, "quantity"]}
                        label="本次到货"
                        rules={[
                          {
                            required: true,
                            type: "number",
                            min: 0,
                            max: item.quantity - item.receivedQuantity,
                          },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          max={item.quantity - item.receivedQuantity}
                          precision={0}
                          disabled={item.quantity === item.receivedQuantity}
                        />
                      </Form.Item>
                    </div>
                  )
                );
              })
            }
          </Form.List>
          <Form.Item
            name="note"
            label="收货说明（选填）"
            rules={[{ max: 500 }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="attachmentIds"
            label="收货凭证（选填，仅总部可查看）"
          >
            <ImageField
              purpose="RECEIPT"
              purchaseOrderId={materials?.purchaseOrderId || undefined}
              ticketId={ticket.id}
              onBusyChange={setUploading}
            />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}

export function CostModal({
  ticket,
  onClose,
  onDone,
}: {
  ticket: Ticket;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [cost, setCost] = useState<Cost>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    api<Cost>(`/repair/tickets/${ticket.id}/costs`)
      .then((data) => {
        if (live) {
          setCost(data);
          form.setFieldsValue({
            laborAmount: data.laborAmount || "",
            otherAmount: data.otherAmount || "",
            note: data.note || "",
          });
        }
      })
      .catch((err) => live && setError(errorText(err)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [ticket.id, form]);
  return (
    <Modal
      open
      title="总部确认维修费用"
      width={570}
      confirmLoading={busy}
      okText="确认费用"
      okButtonProps={{ disabled: !cost || loading }}
      onCancel={() => !busy && onClose()}
      onOk={() => form.submit()}
    >
      {loading ? (
        <Spin />
      ) : (
        <>
          <Paragraph>
            {ticket.ticketNo} · {ticket.title}
          </Paragraph>
          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              className="form-alert"
              action={
                <Button
                  onClick={async () => {
                    try {
                      setCost(
                        await api<Cost>(`/repair/tickets/${ticket.id}/costs`),
                      );
                      setError("");
                    } catch (err) {
                      setError(errorText(err));
                    }
                  }}
                >
                  刷新版本
                </Button>
              }
            />
          )}
          <Paragraph>
            已记录采购金额：<strong>¥ {cost?.purchaseAmount || "—"}</strong>
          </Paragraph>
          <Paragraph type="secondary">
            以下费用由总部核对后确认。无需收费时也请明确填写
            0，门店验收与费用确认各自记录。
          </Paragraph>
          <Form
            form={form}
            layout="vertical"
            disabled={busy}
            onFinish={async (values) => {
              if (!cost) return;
              setBusy(true);
              setError("");
              try {
                await api(`/repair/tickets/${ticket.id}/costs`, {
                  method: "PUT",
                  body: {
                    expectedVersion: cost.ticketVersion,
                    ...(cost.version === null
                      ? {}
                      : { expectedCostVersion: cost.version }),
                    laborAmount: values.laborAmount,
                    otherAmount: values.otherAmount,
                    note: values.note || "",
                  },
                });
                void message.success("维修费用已确认");
                onClose();
                await onDone();
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-two-columns">
              <Form.Item
                name="laborAmount"
                label="确认人工费用（元）"
                rules={[
                  {
                    required: true,
                    pattern: /^\d{1,12}(\.\d{1,2})?$/,
                    message: "填写非负金额，最多两位小数",
                  },
                ]}
              >
                <Input inputMode="decimal" />
              </Form.Item>
              <Form.Item
                name="otherAmount"
                label="确认其他费用（元）"
                rules={[
                  {
                    required: true,
                    pattern: /^\d{1,12}(\.\d{1,2})?$/,
                    message: "填写非负金额，最多两位小数",
                  },
                ]}
              >
                <Input inputMode="decimal" />
              </Form.Item>
            </div>
            <Form.Item
              name="note"
              label="费用说明（选填）"
              rules={[{ max: 1000 }]}
            >
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
}
