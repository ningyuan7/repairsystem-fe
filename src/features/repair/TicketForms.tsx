import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Typography,
} from "antd";
import { api, errorText, Member, Page, Session } from "./api";
import { Asset, Category, actionNames, Ticket } from "./business";
import { ImageField } from "./PrivateImages";
const { Paragraph } = Typography;

async function allMembers(): Promise<Member[]> {
  const members: Member[] = [];
  let page = 1,
    result: Page<Member>;
  do {
    result = await api<Page<Member>>(`/repair/members?page=${page++}&size=100`);
    members.push(...result.items);
  } while (members.length < result.total && page <= 100);
  return members;
}

export function NewTicket({
  session,
  onClose,
  onCreated,
}: {
  session: Session;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form] = Form.useForm();
  const storeId: string | undefined = Form.useWatch("storeId", form),
    assetId: string | undefined = Form.useWatch("assetId", form);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState("known"),
    [categories, setCategories] = useState<Category[]>([]),
    [assets, setAssets] = useState<Asset[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const selected = assets.find((asset) => asset.id === assetId);
  const loadCategories = useCallback(async () => {
    setError("");
    try {
      setCategories(await api<Category[]>("/repair/categories"));
    } catch (err) {
      setError(errorText(err));
    }
  }, []);
  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);
  useEffect(() => {
    let live = true;
    if (!storeId) {
      setAssets([]);
      return;
    }
    setLoading(true);
    api<Page<Asset>>(
      `/repair/assets?storeId=${storeId}&lifecycle=ACTIVE&size=100`,
    )
      .then((data) => live && setAssets(data.items))
      .catch((err) => live && setError(errorText(err)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [storeId]);
  return (
    <Drawer
      open
      title="提交门店报修"
      width={700}
      onClose={() => !busy && !uploading && onClose()}
      extra={
        <Button
          type="primary"
          loading={busy}
          disabled={uploading}
          onClick={() => form.submit()}
        >
          提交报修
        </Button>
      }
    >
      <Paragraph type="secondary">
        说明故障发生的位置与现象，总部审核后安排维修。照片和联系方式仅向有权限的协作成员展示。
      </Paragraph>
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          className="form-alert"
          action={
            !categories.length ? (
              <Button onClick={() => void loadCategories()}>重试</Button>
            ) : undefined
          }
        />
      )}
      {!categories.length && !error && (
        <Alert
          type="info"
          message="当前没有启用的报修分类，请联系总部先维护分类。"
          className="form-alert"
        />
      )}
      <Form
        form={form}
        disabled={busy}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          storeId: session.allowedStores.filter(
            (store) => store.status === "ACTIVE",
          )[0]?.id,
          priority: "NORMAL",
          contactName: session.displayName,
          contactPhone: session.contactPhone,
          attachmentIds: [],
        }}
        onFinish={async (values) => {
          setBusy(true);
          setError("");
          try {
            const result = await api<{ ticketId: string }>("/repair/tickets", {
              method: "POST",
              body: {
                storeId: values.storeId,
                ...(mode === "known"
                  ? { assetId: values.assetId }
                  : {
                      facilityName: values.facilityName,
                      zone: values.zone,
                      brand: values.brand || null,
                      model: values.model || null,
                    }),
                categoryId: values.categoryId,
                title: values.title,
                description: values.description,
                contactName: values.contactName,
                contactPhone: values.contactPhone,
                priority: values.priority,
                attachmentIds: values.attachmentIds || [],
              },
            });
            onCreated(result.ticketId);
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Form.Item
          name="storeId"
          label="报修门店"
          rules={[{ required: true, message: "请选择门店" }]}
        >
          <Select
            options={session.allowedStores
              .filter((store) => store.status === "ACTIVE")
              .map((store) => ({ value: store.id, label: store.name }))}
            onChange={() =>
              form.setFieldsValue({ assetId: undefined, attachmentIds: [] })
            }
          />
        </Form.Item>
        <Form.Item label="设施识别方式">
          <Radio.Group
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            options={[
              { value: "known", label: "选择台账设施" },
              { value: "manual", label: "设施尚未登记" },
            ]}
          />
        </Form.Item>
        {mode === "known" ? (
          <>
            <Form.Item
              name="assetId"
              label="故障设施"
              rules={[
                {
                  required: true,
                  message: "请选择设施；未找到时可改为手动填写",
                },
              ]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={loading}
                placeholder="按名称、台账编号选择"
                options={assets.map((asset) => ({
                  value: asset.id,
                  label: `${asset.name} · ${asset.assetCode} · ${asset.zone}`,
                }))}
              />
            </Form.Item>
            {selected && (
              <Descriptions
                className="form-alert"
                size="small"
                bordered
                column={1}
                items={[
                  { key: "zone", label: "位置", children: selected.zone },
                  {
                    key: "brand",
                    label: "原品牌 / 型号",
                    children:
                      [selected.brand, selected.model]
                        .filter(Boolean)
                        .join(" / ") || "未标注",
                  },
                ]}
              />
            )}
          </>
        ) : (
          <>
            <Form.Item
              name="facilityName"
              label="设施名称"
              rules={[{ required: true, whitespace: true, max: 128 }]}
            >
              <Input placeholder="例如 后厨立式冷柜" />
            </Form.Item>
            <Form.Item
              name="zone"
              label="具体位置"
              rules={[{ required: true, whitespace: true, max: 128 }]}
            >
              <Input placeholder="例如 后厨东侧靠墙" />
            </Form.Item>
            <div className="form-two-columns">
              <Form.Item
                name="brand"
                label="原设施品牌（选填）"
                rules={[{ max: 128 }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="model"
                label="原设施型号（选填）"
                rules={[{ max: 128 }]}
              >
                <Input />
              </Form.Item>
            </div>
          </>
        )}
        <div className="form-two-columns">
          <Form.Item
            name="categoryId"
            label="报修分类"
            rules={[{ required: true, message: "请选择分类" }]}
          >
            <Select
              placeholder="选择故障所属类别"
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="priority"
            label="紧急程度"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "NORMAL", label: "普通 · 可按计划处理" },
                { value: "URGENT", label: "紧急 · 影响门店营业" },
              ]}
            />
          </Form.Item>
        </div>
        <Form.Item
          name="title"
          label="故障标题"
          rules={[{ required: true, whitespace: true, max: 100 }]}
        >
          <Input
            maxLength={100}
            placeholder="例如 冷柜温度持续偏高，无法降至设定温度"
          />
        </Form.Item>
        <Form.Item
          name="description"
          label="故障描述"
          rules={[{ required: true, whitespace: true, max: 2000 }]}
        >
          <Input.TextArea
            rows={4}
            showCount
            maxLength={2000}
            placeholder="何时发现、影响范围、已做的临时处理，以及工程师需要注意的现场情况。"
          />
        </Form.Item>
        <Form.Item name="attachmentIds" label="现场照片（选填）">
          <ImageField
            purpose="FAULT"
            storeId={storeId}
            onBusyChange={setUploading}
          />
        </Form.Item>
        <div className="form-two-columns">
          <Form.Item
            name="contactName"
            label="门店联系人"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input autoComplete="name" />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label="联系电话"
            rules={[{ required: true, whitespace: true, max: 32 }]}
          >
            <Input autoComplete="tel" />
          </Form.Item>
        </div>
      </Form>
    </Drawer>
  );
}

export function TicketAction({
  ticket,
  action,
  onClose,
  onDone,
  onReload,
  session,
}: {
  ticket: Ticket;
  action: string;
  onClose: () => void;
  onDone: () => Promise<void>;
  onReload: () => Promise<void>;
  session: Session;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [engineers, setEngineers] = useState<Member[]>([]),
    [assets, setAssets] = useState<Asset[]>([]);
  const reasonRequired =
    [
      "reject",
      "cancel",
      "asset-link",
      "withdraw-assignment",
      "reassign",
      "return",
    ].includes(action) ||
    (action === "confirm" && session.role === "HQ_ADMIN");
  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (["assign", "reassign"].includes(action))
        setEngineers(
          (await allMembers()).filter(
            (member) =>
              member.role === "ENGINEER" &&
              member.status === "ACTIVE" &&
              member.id !== ticket.assigneeId,
          ),
        );
      if (action === "asset-link")
        setAssets(
          (
            await api<Page<Asset>>(
              `/repair/assets?storeId=${ticket.storeId}&lifecycle=ACTIVE&size=100`,
            )
          ).items,
        );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [action, ticket.assigneeId, ticket.storeId]);
  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);
  return (
    <Modal
      open
      title={actionNames[action]}
      width={600}
      onCancel={() => !busy && !uploading && onClose()}
      confirmLoading={busy}
      maskClosable={!busy}
      okText="确认保存"
      cancelButtonProps={{ disabled: busy }}
      okButtonProps={{
        disabled:
          loading || uploading || !ticket.allowedActions.includes(action),
      }}
      onOk={() => form.submit()}
    >
      <Paragraph type="secondary">
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
              size="small"
              onClick={async () => {
                await onReload();
                void loadOptions();
              }}
            >
              刷新工单
            </Button>
          }
        />
      )}
      {!ticket.allowedActions.includes(action) && (
        <Alert
          type="warning"
          message="工单状态或权限已变更，请关闭窗口后按最新状态处理。"
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={busy}
        requiredMark={false}
        initialValues={{
          priority: ticket.priority,
          attachmentIds: [],
        }}
        onFinish={async (values) => {
          setBusy(true);
          setError("");
          try {
            const body: Record<string, unknown> = {
              expectedVersion: ticket.version,
            };
            if (reasonRequired) body.reason = values.reason;
            if (action === "approve")
              Object.assign(body, {
                priority: values.priority,
                procurementRequired: values.resolutionPlan !== "REPAIR",
                resolutionPlan: values.resolutionPlan,
                note: values.note || "",
              });
            else if (["assign", "reassign"].includes(action))
              body.engineerId = values.engineerId;
            else if (action === "asset-link") body.assetId = values.assetId;
            else if (action === "appointment") {
              const local = values.scheduledAt;
              body.scheduledAt = new Date(
                local + (local.length === 16 ? ":00" : "") + "+08:00",
              ).toISOString();
              body.note = values.note || "";
            } else if (action === "work-records") {
              body.note = values.note;
              body.attachmentIds = values.attachmentIds || [];
            } else if (action === "submit-result")
              Object.assign(body, {
                resultNote: values.resultNote,
                attachmentIds: values.attachmentIds,
                ...(values.laborSuggestedAmount
                  ? { laborSuggestedAmount: values.laborSuggestedAmount }
                  : {}),
                ...(values.otherSuggestedAmount
                  ? { otherSuggestedAmount: values.otherSuggestedAmount }
                  : {}),
                ...(values.replacementSerialNumber
                  ? { replacementSerialNumber: values.replacementSerialNumber }
                  : {}),
              });
            else if (values.note) body.note = values.note;
            await api(`/repair/tickets/${ticket.id}/${action}`, {
              method: "POST",
              body,
            });
            void message.success(actionNames[action] + "已保存");
            onClose();
            await onDone();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {action === "approve" && (
          <>
            <Form.Item
              name="resolutionPlan"
              label="处理方案"
              rules={[{ required: true, message: "请选择本次报修的处理方案" }]}
            >
              <Select
                placeholder="请选择：直接维修 / 采购配件 / 替换设备"
                options={[
                  { value: "REPAIR", label: "直接维修 · 无需采购" },
                  { value: "PART_REPAIR", label: "采购配件后维修" },
                  { value: "REPLACEMENT", label: "采购设备并替换" },
                ]}
              />
            </Form.Item>
            <Alert
              type="info"
              showIcon
              message="需要采购时请明确配件维修或设备替换。总部确认已下单后才能派单，材料收齐后才能开工。"
              className="form-alert"
            />
            <Form.Item
              name="priority"
              label="确认优先级"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "NORMAL", label: "普通" },
                  { value: "URGENT", label: "紧急" },
                ]}
              />
            </Form.Item>
          </>
        )}
        {["assign", "reassign"].includes(action) && !loading && !error && engineers.length === 0 && (
          <Alert className="form-alert" showIcon type="info" message="当前没有可用的工程师，请先在“成员与权限”中邀请或启用工程师，再刷新工单。" />
        )}
        {["assign", "reassign"].includes(action) && (
          <Form.Item
            name="engineerId"
            label="维修工程师"
            rules={[{ required: true, message: "请选择工程师" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={loading}
              placeholder="选择有效工程师"
              options={engineers.map((member) => ({
                value: member.id,
                label: `${member.displayName} · ${member.email}`,
              }))}
            />
          </Form.Item>
        )}
        {action === "asset-link" && (
          <Form.Item
            name="assetId"
            label="关联设施"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={loading}
              options={assets.map((asset) => ({
                value: asset.id,
                label: `${asset.name} · ${asset.assetCode} · ${asset.zone}`,
              }))}
            />
          </Form.Item>
        )}
        {action === "appointment" && (
          <Form.Item
            name="scheduledAt"
            label="预计上门时间（北京时间）"
            rules={[{ required: true, message: "请选择预计上门时间" }]}
          >
            <Input type="datetime-local" />
          </Form.Item>
        )}
        {reasonRequired && (
          <Form.Item
            name="reason"
            label={action === "confirm" ? "总部代验收原因" : "处理原因"}
            rules={[{ required: true, whitespace: true, max: 500 }]}
          >
            <Input.TextArea rows={3} showCount maxLength={500} />
          </Form.Item>
        )}
        {action === "submit-result" && (
          <>
            <Form.Item
              name="resultNote"
              label="维修结果说明"
              rules={[{ required: true, whitespace: true, max: 2000 }]}
            >
              <Input.TextArea
                rows={4}
                showCount
                maxLength={2000}
                placeholder="记录故障原因、处理方式、运行验证与后续注意事项。"
              />
            </Form.Item>
            <Form.Item
              name="attachmentIds"
              label="维修结果照片"
              rules={[
                {
                  required: true,
                  type: "array",
                  min: 1,
                  message: "至少上传一张维修结果照片",
                },
              ]}
            >
              <ImageField
                purpose="RESULT"
                ticketId={ticket.id}
                onBusyChange={setUploading}
              />
            </Form.Item>
            {ticket.resolutionPlan === "REPLACEMENT" && (
              <Form.Item
                name="replacementSerialNumber"
                label="新设备实际序列号"
                rules={[{ max: 128 }]}
              >
                <Input />
              </Form.Item>
            )}
            <div className="form-two-columns">
              <Form.Item
                name="laborSuggestedAmount"
                label="建议人工费用（选填）"
                rules={[
                  {
                    pattern: /^\d{1,12}(\.\d{1,2})?$/,
                    message: "请输入最多两位小数的非负金额",
                  },
                ]}
              >
                <Input inputMode="decimal" suffix="元" />
              </Form.Item>
              <Form.Item
                name="otherSuggestedAmount"
                label="建议其他费用（选填）"
                rules={[
                  {
                    pattern: /^\d{1,12}(\.\d{1,2})?$/,
                    message: "请输入最多两位小数的非负金额",
                  },
                ]}
              >
                <Input inputMode="decimal" suffix="元" />
              </Form.Item>
            </div>
            <Paragraph type="secondary">
              建议费用仅供总部核对，最终费用由总部确认。
            </Paragraph>
          </>
        )}
        {!["submit-result", "accept", "start"].includes(action) &&
          !reasonRequired && (
            <Form.Item
              name="note"
              label={
                action === "work-records" ? "维修过程记录" : "补充说明（选填）"
              }
              rules={[
                {
                  required: action === "work-records",
                  whitespace: action === "work-records",
                  max: 1000,
                },
              ]}
            >
              <Input.TextArea rows={3} showCount maxLength={1000} />
            </Form.Item>
          )}
        {action === "work-records" && (
          <Form.Item name="attachmentIds" label="过程照片（选填）">
            <ImageField
              purpose="WORK_RECORD"
              ticketId={ticket.id}
              onBusyChange={setUploading}
            />
          </Form.Item>
        )}
        {["accept", "start", "confirm"].includes(action) && (
          <Paragraph>
            {action === "accept"
              ? "确认接收这项维修任务，随后可预约上门。"
              : action === "start"
                ? "确认已经具备现场维修条件，开始记录维修过程。"
                : "确认设备已经通过现场检查，完成本次报修验收。"}
          </Paragraph>
        )}
      </Form>
    </Modal>
  );
}
