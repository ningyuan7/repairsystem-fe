import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Typography,
} from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { api, errorText, Page, Session } from "./api";
import { dateTime, shanghaiInput, shanghaiIso } from "./business";
const { Title, Text, Paragraph } = Typography;
type Overview = {
  generatedAt: string;
  submitted: number;
  completed: number;
  currentOpen: number;
  completionRate: string | null;
  averageRepairHours: string | null;
  averageCycleHours: string | null;
  averageArrivalHours: string | null;
  purchaseAmount: string;
  confirmedCompletedCostAmount: string;
  confirmedCostCount: number;
  pendingCostCount: number;
};
type StoreRow = {
  id: string;
  name: string;
  region: string;
  submitted: number;
  completed: number;
  currentOpen: number;
  pendingCostCount: number;
  purchaseAmount: string;
  confirmedCompletedCostAmount: string;
  averageRepairHours: string | null;
};
type EngineerRow = {
  id: string;
  name: string;
  completed: number;
  currentOpen: number;
  returned: number;
  averageRepairHours: string | null;
};
type StoreReport = {
  stores: Page<StoreRow>;
  originalFacilityFaults: {
    brand: string | null;
    model: string | null;
    count: number;
  }[];
  purchasedItems: {
    name: string;
    brand: string | null;
    model: string | null;
    quantity: number;
    amount: string;
  }[];
};
export default function Reports({ session }: { session: Session }) {
  const [form] = Form.useForm();
  const [query, setQuery] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    const start = shanghaiIso(shanghaiInput(now.toISOString()).slice(0,7) + '-01T00:00');
    return new URLSearchParams({
      from: start,
      to: now.toISOString(),
    }).toString();
  });
  const [overview, setOverview] = useState<Overview>(),
    [stores, setStores] = useState<StoreReport>(),
    [engineers, setEngineers] = useState<Page<EngineerRow>>(),
    [storePage, setStorePage] = useState(1),
    [engineerPage, setEngineerPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [exporting, setExporting] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [summary, byStore, byEngineer] = await Promise.all([
        api<Overview>("/repair/reports/overview?" + query),
        api<StoreReport>(
          `/repair/reports/stores?${query}&page=${storePage}&size=20`,
        ),
        api<Page<EngineerRow>>(
          `/repair/reports/engineers?${query}&page=${engineerPage}&size=20`,
        ),
      ]);
      setOverview(summary);
      setStores(byStore);
      setEngineers(byEngineer);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, [query, storePage, engineerPage]);
  useEffect(() => {
    const initial = new URLSearchParams(query);
    form.setFieldsValue({
      from: shanghaiInput(initial.get("from")),
      to: shanghaiInput(initial.get("to")),
      storeId: initial.get("storeId") || undefined,
    });
    void load();
  }, [load, form]);
  const empty = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="所选范围暂无数据"
    />
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">总部经营汇总</span>
          <Title level={2}>维修数据汇总</Title>
          <Text type="secondary">
            按门店与工程师跟进故障、采购记录金额和维修费用，日期按北京时间选择。
          </Text>
        </div>
        <Button
          icon={<DownloadOutlined />}
          loading={exporting}
          disabled={busy || !overview}
          onClick={async () => {
            setExporting(true);
            setError("");
            try {
              const blob = await api<Blob>("/repair/reports/export?" + query, {
                responseType: "blob",
              });
              const url = URL.createObjectURL(blob),
                anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = "维修工单汇总.csv";
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (err) {
              setError(errorText(err));
            } finally {
              setExporting(false);
            }
          }}
        >
          导出工单 CSV
        </Button>
      </div>
      <section className="work-panel report-filters">
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => {
            const from = shanghaiIso(values.from),
              to = shanghaiIso(values.to);
            if (from >= to) {
              setError("开始时间必须早于结束时间");
              return;
            }
            const params = new URLSearchParams({ from, to });
            if (values.storeId) params.set("storeId", values.storeId);
            setStorePage(1);
            setEngineerPage(1);
            setQuery(params.toString());
          }}
        >
          <div className="report-filter-grid">
            <Form.Item
              name="from"
              label="开始时间（含）"
              rules={[{ required: true }]}
            >
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item
              name="to"
              label="结束时间（不含）"
              rules={[{ required: true }]}
            >
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item name="storeId" label="门店范围">
              <Select
                allowClear
                placeholder="全部门店"
                options={session.allowedStores.map((store) => ({
                  value: store.id,
                  label: store.name,
                }))}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy} aria-label="查询汇总">
              查询汇总
            </Button>
          </div>
        </Form>
      </section>
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          className="form-alert"
          action={
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              重试
            </Button>
          }
        />
      )}
      <Alert
        className="scope-note"
        type="info"
        showIcon
        message="提交数按提交时间，完成数和已确认费用按完成时间，采购金额按下单时间；当前未结为实时存量，不受所选日期限制。"
      />
      {!overview && !error ? (
        <Spin />
      ) : (
        overview && (
          <>
            <div className="metric-grid report-metrics">
              {[
                ["范围内新报修", overview.submitted],
                ["范围内已完成", overview.completed],
                ["当前未结", overview.currentOpen],
                [
                  "提交批次完成率",
                  overview.completionRate === null
                    ? "—"
                    : (Number(overview.completionRate) * 100).toFixed(1) + "%",
                ],
              ].map(([label, value]) => (
                <div className="metric" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <section className="work-panel report-costs">
              <div>
                <Text type="secondary">采购记录金额</Text>
                <strong>¥ {overview.purchaseAmount}</strong>
                <small>有效已下单记录，按下单时间</small>
              </div>
              <div>
                <Text type="secondary">已确认完成单费用</Text>
                <strong>¥ {overview.confirmedCompletedCostAmount}</strong>
                <small>
                  已确认 {overview.confirmedCostCount} 张 · 待核算{" "}
                  {overview.pendingCostCount} 张
                </small>
              </div>
              <div>
                <Text type="secondary">平均维修耗时</Text>
                <strong>
                  {overview.averageRepairHours === null
                    ? "—"
                    : overview.averageRepairHours + " 小时"}
                </strong>
                <small>首次开工至最终完工，按完成单取样</small>
              </div>
            </section>
            <Paragraph type="secondary">
              平均全流程 {overview.averageCycleHours ?? "—"} 小时 · 平均到货{" "}
              {overview.averageArrivalHours ?? "—"} 小时 · 更新于{" "}
              {dateTime(overview.generatedAt)}
            </Paragraph>
            <Tabs
              items={[
                {
                  key: "stores",
                  label: "门店汇总",
                  children: (
                    <section className="work-panel table-panel">
                      <Table
                        rowKey="id"
                        dataSource={stores?.stores.items || []}
                        loading={busy}
                        scroll={{ x: 1050 }}
                        locale={{ emptyText: empty }}
                        pagination={{
                          current: storePage,
                          pageSize: 20,
                          total: Number(stores?.stores.total || 0),
                          showSizeChanger: false,
                          onChange: setStorePage,
                        }}
                        columns={[
                          { title: "门店", dataIndex: "name", width: 180 },
                          {
                            title: "新报修",
                            dataIndex: "submitted",
                            width: 85,
                          },
                          { title: "完成", dataIndex: "completed", width: 85 },
                          {
                            title: "当前未结",
                            dataIndex: "currentOpen",
                            width: 100,
                          },
                          {
                            title: "采购记录金额",
                            dataIndex: "purchaseAmount",
                            width: 140,
                            render: (value) => "¥ " + value,
                          },
                          {
                            title: "已确认完成单费用",
                            dataIndex: "confirmedCompletedCostAmount",
                            width: 170,
                            render: (value) => "¥ " + value,
                          },
                          {
                            title: "待核算",
                            dataIndex: "pendingCostCount",
                            width: 90,
                          },
                          {
                            title: "平均维修（小时）",
                            dataIndex: "averageRepairHours",
                            render: (value) => value ?? "—",
                          },
                        ]}
                      />
                    </section>
                  ),
                },
                {
                  key: "engineers",
                  label: "工程师汇总",
                  children: (
                    <section className="work-panel table-panel">
                      <Table
                        rowKey="id"
                        dataSource={engineers?.items || []}
                        loading={busy}
                        scroll={{ x: 650 }}
                        locale={{ emptyText: empty }}
                        pagination={{
                          current: engineerPage,
                          pageSize: 20,
                          total: Number(engineers?.total || 0),
                          showSizeChanger: false,
                          onChange: setEngineerPage,
                        }}
                        columns={[
                          { title: "工程师", dataIndex: "name" },
                          { title: "当前未结", dataIndex: "currentOpen" },
                          { title: "范围内完成", dataIndex: "completed" },
                          { title: "完成单退回次数", dataIndex: "returned" },
                          {
                            title: "平均维修（小时）",
                            dataIndex: "averageRepairHours",
                            render: (value) => value ?? "—",
                          },
                        ]}
                      />
                      <Paragraph className="panel-body" type="secondary">
                        按当前或最终受派工程师归属，改派前工作记录保留在工单中。
                      </Paragraph>
                    </section>
                  ),
                },
                {
                  key: "facilities",
                  label: "原设施故障分析",
                  children: (
                    <section className="work-panel table-panel">
                      <Table
                        rowKey={(_, index) => String(index)}
                        dataSource={stores?.originalFacilityFaults || []}
                        pagination={false}
                        scroll={{ x: 520 }}
                        locale={{ emptyText: empty }}
                        columns={[
                          {
                            title: "原品牌",
                            dataIndex: "brand",
                            render: (value) => value || "未标注",
                          },
                          {
                            title: "原型号",
                            dataIndex: "model",
                            render: (value) => value || "未标注",
                          },
                          { title: "报修数", dataIndex: "count" },
                        ]}
                      />
                    </section>
                  ),
                },
                {
                  key: "purchases",
                  label: "采购物品统计",
                  children: (
                    <section className="work-panel table-panel">
                      <Table
                        rowKey={(_, index) => String(index)}
                        dataSource={stores?.purchasedItems || []}
                        pagination={false}
                        scroll={{ x: 700 }}
                        locale={{ emptyText: empty }}
                        columns={[
                          { title: "物品", dataIndex: "name" },
                          {
                            title: "采购品牌",
                            dataIndex: "brand",
                            render: (value) => value || "未标注",
                          },
                          {
                            title: "采购型号",
                            dataIndex: "model",
                            render: (value) => value || "未标注",
                          },
                          { title: "采购数量", dataIndex: "quantity" },
                          {
                            title: "明细金额",
                            dataIndex: "amount",
                            render: (value) => "¥ " + value,
                          },
                        ]}
                      />
                      <Paragraph className="panel-body" type="secondary">
                        按有效订单下单时间统计商品数量与明细金额，不包含订单级运费和折扣。分析表各展示最多
                        100 个分组。
                      </Paragraph>
                    </section>
                  ),
                },
              ]}
            />
            <Paragraph type="secondary">
              CSV 每行一张工单，按提交时间筛选，最多 10,000
              行。待核算总费用保留空白。
            </Paragraph>
          </>
        )
      )}
    </>
  );
}
