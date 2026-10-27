import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { api, errorText, Session } from "./api";
import { dateTime, statusColors, statusNames, TicketStatus } from "./business";
import EngineerDispatch from "./EngineerDispatch";
const { Title, Text } = Typography;
type DashboardData = {
  statuses: { status: TicketStatus; count: number }[];
  tasks: {
    id: string;
    ticketNo: string;
    title: string;
    storeName: string;
    status: TicketStatus;
    priority: string;
    submittedAt: string;
  }[];
  overdueCount: number;
  unreadCount: number;
  generatedAt: string;
};
export default function Dashboard({ session }: { session: Session }) {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await api<DashboardData>("/repair/dashboard"));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);
  const hq = session.role === "HQ_ADMIN",
    engineer = session.role === "ENGINEER";
  const cards: TicketStatus[] = engineer
    ? ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "WAITING_ACCEPTANCE"]
    : hq
      ? [
          "SUBMITTED",
          "WAITING_PROCUREMENT",
          "READY_FOR_DISPATCH",
          "WAITING_ACCEPTANCE",
        ]
      : ["SUBMITTED", "IN_PROGRESS", "WAITING_ACCEPTANCE", "COMPLETED"];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {hq ? "总部运营" : engineer ? "现场维修" : "门店协作"}
          </span>
          <Title level={2}>欢迎，{session.displayName}</Title>
          <Text type="secondary">
            {hq
              ? "先处理待审核与待派单工单，关注材料等待和门店验收。"
              : engineer
                ? "按预约安排现场维修，完工后提交结果供门店验收。"
                : "发现故障及时上报，材料到货后登记数量，维修完成后确认验收。"}
          </Text>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            loading={busy}
            onClick={() => void load()}
          >
            刷新
          </Button>
          {session.role === "STORE_MANAGER" && (
            <Button
              type="primary"
              icon={<PlusOutlined />} aria-label="提交报修"
              onClick={() => navigate("/tickets/new")}
            >
              提交报修
            </Button>
          )}
        </Space>
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          message={error}
          action={<Button onClick={() => void load()}>重试</Button>}
          className="form-alert"
        />
      )}
      {!data && !error ? (
        <Spin />
      ) : (
        data && (
          <>
            <div className="metric-grid">
              {cards.map((status) => (
                <button
                  className="metric"
                  key={status}
                  onClick={() => navigate("/tickets?status=" + status)}
                >
                  <span>{statusNames[status]}</span>
                  <strong>
                    {Number(
                      data.statuses.find((row) => row.status === status)
                        ?.count || 0,
                    ).toLocaleString("zh-CN")}
                  </strong>
                  <small>
                    {engineer
                      ? "当前本人任务"
                      : hq
                        ? "全部门店"
                        : "授权门店范围"}
                  </small>
                </button>
              ))}
            </div>
            <div className="dashboard-context">
              <Text
                type={Number(data.overdueCount) > 0 ? "warning" : "secondary"}
              >
                当前超时未结：{data.overdueCount} 张
              </Text>
              <Text type="secondary">
                未读通知 {data.unreadCount} 条 · 更新于{" "}
                {dateTime(data.generatedAt)}
              </Text>
            </div>
            <section className="work-panel table-panel">
              <div className="panel-heading">
                <Title level={4}>
                  {hq
                    ? "待协调事项"
                    : engineer
                      ? "当前待处理任务"
                      : "待门店验收"}
                </Title>
                <Button type="link" onClick={() => navigate("/tickets")}>
                  查看全部工单
                </Button>
              </div>
              <Table
                size="middle"
                rowKey="id"
                pagination={false}
                dataSource={data.tasks}
                scroll={{ x: 680 }}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        hq
                          ? "当前没有需要协调的事项"
                          : engineer
                            ? "暂无当前待处理任务"
                            : "暂无待验收工单"
                      }
                    />
                  ),
                }}
                columns={[
                  {
                    title: "工单与故障",
                    key: "title",
                    render: (_, row) => (
                      <>
                        <Button
                          className="ticket-title"
                          type="link"
                          onClick={() => navigate("/tickets/" + row.id)}
                        >
                          {row.title}
                        </Button>
                        <div className="secondary">
                          {row.ticketNo} · {row.storeName}
                        </div>
                      </>
                    ),
                  },
                  {
                    title: "状态",
                    dataIndex: "status",
                    width: 110,
                    render: (value: TicketStatus) => (
                      <Tag color={statusColors[value]}>
                        {statusNames[value]}
                      </Tag>
                    ),
                  },
                  {
                    title: "优先级",
                    dataIndex: "priority",
                    width: 90,
                    render: (value) =>
                      value === "URGENT" ? <Tag color="red">紧急</Tag> : "普通",
                  },
                  {
                    title: "提交时间",
                    dataIndex: "submittedAt",
                    width: 155,
                    render: dateTime,
                  },
                ]}
              />
            </section>
            {hq && <EngineerDispatch refreshKey={data.generatedAt} />}
            {hq && (
              <div className="quick-links">
                <Button onClick={() => navigate("/hq/reports")}>
                  查看总部汇总
                </Button>
                <Button onClick={() => navigate("/stores")}>维护门店</Button>
                <Button onClick={() => navigate("/hq/members")}>
                  邀请成员
                </Button>
              </div>
            )}
          </>
        )
      )}
    </>
  );
}

