import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { api, errorText, Page, Session } from "./api";
import { Asset, Category } from "./business";
const { Title, Text, Paragraph } = Typography;
const conditions: Record<Asset["condition"], string> = {
  NORMAL: "正常",
  FAULTY: "故障",
  REPAIRING: "维修中",
};

export function AssetRegistry({ session }: { session: Session }) {
  const { message } = App.useApp();
  const hq = session.role === "HQ_ADMIN";
  const [rows, setRows] = useState<Asset[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [storeId, setStoreId] = useState<string>(),
    [condition, setCondition] = useState<string>(),
    [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<Asset | null | undefined>(),
    [target, setTarget] = useState<Asset>(),
    [action, setAction] = useState<"condition" | "retire">(),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState("");
  const [form] = Form.useForm(),
    [actionForm] = Form.useForm();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), size: "20" });
    if (storeId) query.set("storeId", storeId);
    if (condition) query.set("condition", condition);
    if (keyword) query.set("keyword", keyword);
    try {
      const data = await api<Page<Asset>>("/repair/assets?" + query);
      setRows(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [page, storeId, condition, keyword]);
  useEffect(() => {
    void load();
  }, [load]);
  const edit = (asset: Asset | null) => {
    setSaveError("");
    setEditing(asset);
    form.resetFields();
    form.setFieldsValue(
      asset
        ? {
            ...asset,
            brand: asset.brand || "",
            model: asset.model || "",
            serialNumber: asset.serialNumber || "",
          }
        : {
            storeId: session.allowedStores.find(
              (store) => store.status === "ACTIVE",
            )?.id,
            assetCode: "",
            name: "",
            zone: "",
            brand: "",
            model: "",
            serialNumber: "",
          },
    );
  };
  const manage = (asset: Asset, value: "condition" | "retire") => {
    setTarget(asset);
    setAction(value);
    setSaveError("");
    actionForm.resetFields();
    actionForm.setFieldsValue({
      condition: asset.condition === "REPAIRING" ? "FAULTY" : asset.condition,
    });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">门店设施台账</span>
          <Title level={2}>设施管理</Title>
          <Text type="secondary">
            保留原设备身份与位置，按设施追溯故障和维修记录。
          </Text>
        </div>
        {hq && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => edit(null)}
          >
            新增设施
          </Button>
        )}
      </div>
      <section className="work-panel table-panel">
        <div className="table-toolbar">
          <Space wrap>
            <Input.Search
              placeholder="设施名称 / 编号 / 型号"
              aria-label="搜索设施"
              allowClear
              style={{ width: 235 }}
              onSearch={(value) => {
                setKeyword(value);
                setPage(1);
              }}
            />
            {session.allowedStores.length > 1 && (
              <Select
                allowClear
                placeholder="全部门店"
                aria-label="筛选设施门店"
                style={{ width: 160 }}
                onChange={(value) => {
                  setStoreId(value);
                  setPage(1);
                }}
                options={session.allowedStores.map((store) => ({
                  value: store.id,
                  label: store.name,
                }))}
              />
            )}
            <Select
              allowClear
              placeholder="全部设备状态"
              aria-label="筛选设施状态"
              style={{ width: 140 }}
              onChange={(value) => {
                setCondition(value);
                setPage(1);
              }}
              options={Object.entries(conditions).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Space>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        </div>
        {error ? (
          <Alert
            showIcon
            type="error"
            message={error}
            action={<Button onClick={() => void load()}>重试</Button>}
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={rows}
            loading={loading}
            scroll={{ x: 1080 }}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              showSizeChanger: false,
              onChange: setPage,
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无设施台账，未登记的设施仍可由门店手动报修"
                />
              ),
            }}
            columns={[
              {
                title: "设施",
                key: "asset",
                width: 220,
                render: (_, row: Asset) => (
                  <div>
                    <strong>{row.name}</strong>
                    <div className="secondary">{row.assetCode}</div>
                  </div>
                ),
              },
              {
                title: "门店 / 位置",
                key: "store",
                width: 200,
                render: (_, row: Asset) => (
                  <div>
                    {session.allowedStores.find(
                      (store) => store.id === row.storeId,
                    )?.name || "授权门店"}
                    <div className="secondary">{row.zone}</div>
                  </div>
                ),
              },
              {
                title: "原品牌 / 型号",
                key: "spec",
                width: 220,
                render: (_, row: Asset) => (
                  <div>
                    {row.brand || "品牌未标注"}
                    <div className="secondary">{row.model || "型号未标注"}</div>
                  </div>
                ),
              },
              {
                title: "设备状态",
                key: "state",
                width: 120,
                render: (_, row: Asset) =>
                  row.lifecycle === "RETIRED" ? (
                    <Tag>已退役</Tag>
                  ) : (
                    <Tag
                      color={
                        row.condition === "NORMAL"
                          ? "success"
                          : row.condition === "FAULTY"
                            ? "gold"
                            : "blue"
                      }
                    >
                      {conditions[row.condition]}
                    </Tag>
                  ),
              },
              ...(hq
                ? [
                    {
                      title: "操作",
                      key: "action",
                      width: 250,
                      render: (_: unknown, row: Asset) => (
                        <Space size={0}>
                          <Button
                            type="link"
                            disabled={row.lifecycle === "RETIRED"}
                            onClick={() => edit(row)}
                          >
                            编辑
                          </Button>
                          <Button
                            type="link"
                            disabled={
                              row.lifecycle === "RETIRED" ||
                              row.condition === "REPAIRING"
                            }
                            onClick={() => manage(row, "condition")}
                          >
                            核正状态
                          </Button>
                          <Button
                            type="link"
                            danger
                            disabled={row.lifecycle === "RETIRED"}
                            onClick={() => manage(row, "retire")}
                          >
                            退役
                          </Button>
                        </Space>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </section>
      <Drawer
        title={editing ? "编辑设施台账" : "新增设施台账"}
        open={editing !== undefined}
        width={530}
        onClose={() => !busy && setEditing(undefined)}
        extra={
          <Button type="primary" loading={busy} onClick={() => form.submit()}>
            保存
          </Button>
        }
      >
        <Paragraph type="secondary">
          原设施品牌与型号只描述门店当前这件设备，采购的新配件信息单独记录。
        </Paragraph>
        {saveError && (
          <Alert
            type="error"
            showIcon
            message={saveError}
            className="form-alert"
          />
        )}
        <Form
          form={form}
          layout="vertical"
          disabled={busy}
          requiredMark={false}
          onFinish={async (values) => {
            setBusy(true);
            setSaveError("");
            try {
              const {
                storeId,
                assetCode,
                name,
                zone,
                brand,
                model,
                serialNumber,
              } = values;
              await api("/repair/assets" + (editing ? "/" + editing.id : ""), {
                method: editing ? "PUT" : "POST",
                body: {
                  storeId,
                  assetCode,
                  name,
                  zone,
                  brand,
                  model,
                  serialNumber,
                  ...(editing ? { expectedVersion: editing.version } : {}),
                },
              });
              setEditing(undefined);
              void message.success("设施台账已保存");
              await load();
            } catch (err) {
              setSaveError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item
            name="storeId"
            label="所属门店"
            rules={[{ required: true }]}
          >
            <Select
              options={session.allowedStores
                .filter(
                  (store) =>
                    store.status === "ACTIVE" || store.id === editing?.storeId,
                )
                .map((store) => ({
                  value: store.id,
                  label:
                    store.name +
                    (store.status === "DISABLED" ? "（停用）" : ""),
                  disabled: store.status === "DISABLED",
                }))}
            />
          </Form.Item>
          <Form.Item
            name="assetCode"
            label="设施编号"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input placeholder="例如 SH001-FREEZER-01" />
          </Form.Item>
          <Form.Item
            name="name"
            label="设施名称"
            rules={[{ required: true, whitespace: true, max: 128 }]}
          >
            <Input placeholder="例如 后厨立式冷柜" />
          </Form.Item>
          <Form.Item
            name="zone"
            label="安装位置"
            rules={[{ required: true, whitespace: true, max: 128 }]}
          >
            <Input placeholder="例如 后厨东侧靠墙" />
          </Form.Item>
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
          <Form.Item
            name="serialNumber"
            label="序列号（选填）"
            rules={[{ max: 128 }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Drawer>
      <Modal
        open={!!action}
        title={action === "retire" ? "退役设施" : "人工核正设施状态"}
        confirmLoading={busy}
        okText="确认操作"
        onCancel={() => !busy && setAction(undefined)}
        onOk={() => actionForm.submit()}
      >
        <Paragraph>
          {target?.name} · {target?.assetCode}
          。存在未结工单时，系统会拒绝手动变更。
        </Paragraph>
        {saveError && <Alert showIcon type="error" message={saveError} />}
        <Form
          form={actionForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!target || !action) return;
            setBusy(true);
            setSaveError("");
            try {
              await api(`/repair/assets/${target.id}/${action}`, {
                method: "POST",
                body: {
                  expectedVersion: target.version,
                  reason: values.reason,
                  ...(action === "condition"
                    ? { condition: values.condition }
                    : {}),
                },
              });
              setAction(undefined);
              void message.success("设施状态已更新");
              await load();
            } catch (err) {
              setSaveError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {action === "condition" && (
            <Form.Item
              name="condition"
              label="核正后的状态"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "NORMAL", label: "正常" },
                  { value: "FAULTY", label: "故障" },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label="操作原因"
            rules={[{ required: true, whitespace: true, max: 500 }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function CategoryRegistry() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Category[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<Category | null | undefined>(),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState("");
  const [form] = Form.useForm();
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await api<Category[]>("/repair/categories?includeDisabled=true"));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const edit = (row: Category | null) => {
    setEditing(row);
    setSaveError("");
    form.resetFields();
    form.setFieldsValue(row || { code: "", name: "", status: "ACTIVE" });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">基础字典</span>
          <Title level={2}>报修分类</Title>
          <Text type="secondary">
            分类用于故障受理和汇总；停用后不影响历史工单继续处理。
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => edit(null)}
        >
          新增分类
        </Button>
      </div>
      <section className="work-panel table-panel">
        <div className="table-toolbar">
          <strong>分类列表 · {rows.length}</strong>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void load()}
          >
            刷新
          </Button>
        </div>
        {error ? (
          <Alert
            showIcon
            type="error"
            message={error}
            action={<Button onClick={() => void load()}>重试</Button>}
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={rows}
            loading={loading}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="尚无报修分类，先添加门店实际使用的故障类别"
                />
              ),
            }}
            columns={[
              { title: "分类名称", dataIndex: "name" },
              { title: "内部编码", dataIndex: "code" },
              {
                title: "状态",
                dataIndex: "status",
                render: (value) => (
                  <Tag color={value === "ACTIVE" ? "green" : "default"}>
                    {value === "ACTIVE" ? "启用" : "停用"}
                  </Tag>
                ),
              },
              {
                title: "操作",
                key: "action",
                render: (_, row: Category) => (
                  <Button type="link" onClick={() => edit(row)}>
                    编辑
                  </Button>
                ),
              },
            ]}
          />
        )}
      </section>
      <Drawer
        open={editing !== undefined}
        width={440}
        title={editing ? "编辑报修分类" : "新增报修分类"}
        onClose={() => !busy && setEditing(undefined)}
        extra={
          <Button type="primary" loading={busy} onClick={() => form.submit()}>
            保存
          </Button>
        }
      >
        {saveError && (
          <Alert
            type="error"
            showIcon
            message={saveError}
            className="form-alert"
          />
        )}
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={async (values) => {
            setBusy(true);
            setSaveError("");
            try {
              const { code, name, status } = values;
              await api(
                "/repair/categories" + (editing ? "/" + editing.id : ""),
                {
                  method: editing ? "PUT" : "POST",
                  body: {
                    code,
                    name,
                    status,
                    ...(editing ? { expectedVersion: editing.version } : {}),
                  },
                },
              );
              setEditing(undefined);
              void message.success("报修分类已保存");
              await load();
            } catch (err) {
              setSaveError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item
            name="code"
            label="分类编码"
            rules={[
              {
                required: true,
                pattern: /^[A-Za-z0-9_-]{1,32}$/,
                message: "使用最多 32 位字母、数字、下划线或短横线",
              },
            ]}
          >
            <Input placeholder="例如 COOLING" />
          </Form.Item>
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, whitespace: true, max: 128 }]}
          >
            <Input placeholder="例如 制冷设备" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "ACTIVE", label: "启用" },
                { value: "DISABLED", label: "停用" },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
