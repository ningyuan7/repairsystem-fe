import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { api, errorText, Page, Session } from "./api";
import {
  actionNames,
  dateTime,
  Event,
  PurchaseOrder,
  Events,
  statusColors,
  statusNames,
  Ticket,
  TicketStatus,
} from "./business";
import { ImageGallery } from "./PrivateImages";
import { NewTicket, TicketAction } from "./TicketForms";
import TicketNextStep, { nextStep } from "./TicketNextStep";
import { CostModal, MaterialsPanel } from "./MaterialsPanel";
const { Title, Text, Paragraph } = Typography;
const primaryActions = [
  "approve",
  "assign",
  "accept",
  "start",
  "submit-result",
  "confirm",
  "purchase",
  "costs",
];
const actionRank = (value: string) =>
  primaryActions.includes(value) ? primaryActions.indexOf(value) : 100;

export default function Tickets({ session }: { session: Session }) {
  const location = useLocation(),
    navigate = useNavigate();
  const selectedId = location.pathname.match(/^\/tickets\/(\d+)$/)?.[1];
  const creating = location.pathname === "/tickets/new";
  const [action, setAction] = useState<string>();
  const [actionBusy, setActionBusy] = useState(false);
  const [rows, setRows] = useState<Ticket[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const initialStatus = new URLSearchParams(location.search).get("status");
  const [status, setStatus] = useState<TicketStatus | undefined>(
      initialStatus && initialStatus in statusNames
        ? (initialStatus as TicketStatus)
        : undefined,
    ),
    [storeId, setStoreId] = useState<string>();
  const [ticket, setTicket] = useState<Ticket>(),
    [events, setEvents] = useState<Event[]>([]),
    [detailError, setDetailError] = useState(""),
    [detailLoading, setDetailLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), size: "20" });
    if (status) query.set("status", status);
    if (storeId) query.set("storeId", storeId);
    try {
      const result = await api<Page<Ticket>>("/repair/tickets?" + query);
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [page, status, storeId]);
  const loadDetail = useCallback(async () => {
    if (!selectedId) return;
    setDetailLoading(true);
    setDetailError("");
    try {
      const [detail, history] = await Promise.all([
        api<Ticket>("/repair/tickets/" + selectedId),
        api<Events>("/repair/tickets/" + selectedId + "/events"),
      ]);
      setTicket(detail);
      setEvents(history.items);
    } catch (err) {
      setDetailError(errorText(err));
    } finally {
      setDetailLoading(false);
    }
  }, [selectedId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setTicket(undefined);
    void loadDetail();
  }, [loadDetail]);
  const changed = async () => {
    await Promise.all([loadDetail(), load()]);
  };
  const chooseAction = async (item: string) => {
    if (!ticket) return;
    if (item !== "purchase") {
      setAction(item);
      return;
    }
    setActionBusy(true);
    setDetailError("");
    try {
      const orders = await api<PurchaseOrder[]>(
        `/repair/tickets/${ticket.id}/purchase-orders`,
      );
      let id = orders.find((order) => order.status !== "CANCELLED")?.id;
      if (!id && ticket.status === "WAITING_PROCUREMENT")
        id = (
          await api<{ purchaseOrderId: string }>(
            `/repair/tickets/${ticket.id}/purchase-orders`,
            { method: "POST", body: { expectedTicketVersion: ticket.version } },
          )
        ).purchaseOrderId;
      if (!id) throw new Error("当前工单没有可用的采购记录，请刷新工单状态");
      navigate("/hq/purchases/" + id);
    } catch (err) {
      setDetailError(errorText(err));
    } finally {
      setActionBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">维修任务队列</span>
          <Title level={2}>
            {session.role === "ENGINEER" ? "我的维修任务" : "工单工作台"}
          </Title>
          <Text type="secondary">
            {session.role === "HQ_ADMIN"
              ? "按处理阶段安排审核、派单与验收，跟进每家门店的设施故障。"
              : session.role === "STORE_MANAGER"
                ? "查看负责门店的维修进展，故障处理后及时验收。"
                : "查看当前指派给你的任务，接单后安排上门并记录维修结果。"}
          </Text>
        </div>
        {session.role === "STORE_MANAGER" && (
          <Button
            type="primary"
            icon={<PlusOutlined />} aria-label="提交报修"
            onClick={() => navigate("/tickets/new")}
          >
            提交报修
          </Button>
        )}
      </div>
      <section className="work-panel table-panel">
        <div className="table-toolbar">
          <Space wrap>
            <Select
              allowClear
              placeholder="全部状态"
              aria-label="筛选工单状态"
              style={{ width: 150 }}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={Object.entries(statusNames).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            {session.allowedStores.length > 1 && (
              <Select
                allowClear
                placeholder="全部门店"
                aria-label="筛选门店"
                style={{ width: 180 }}
                value={storeId}
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
            <Text type="secondary">共 {total} 张工单</Text>
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void load()}
            loading={loading}
          >
            刷新
          </Button>
        </div>
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={<Button onClick={() => void load()}>重试</Button>}
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={rows}
            loading={loading}
            scroll={{ x: 1050 }}
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
                  description="当前范围内暂无工单"
                />
              ),
            }}
            columns={[
              ...(session.role === "HQ_ADMIN" ? [{
                title: "下一步", key: "next", width: 150,
                render: (_: unknown, row: Ticket) => {
                  const next = nextStep(row);
                  return next.action && row.allowedActions.includes(next.action)
                    ? <Button type="link" onClick={() => navigate("/tickets/" + row.id)}>{next.label}</Button>
                    : <Text type="secondary">{next.title}</Text>;
                },
              }] : []),
              {
                title: "工单与故障",
                key: "title",
                width: 310,
                render: (_, row: Ticket) => (
                  <div>
                    <Button
                      className="ticket-title"
                      type="link"
                      onClick={() => navigate("/tickets/" + row.id)}
                    >
                      {row.title}
                    </Button>
                    <div className="secondary">
                      {row.ticketNo} · {row.facilitySnapshot.facilityName}
                    </div>
                  </div>
                ),
              },
              {
                title: "门店 / 位置",
                key: "store",
                width: 210,
                render: (_, row: Ticket) => (
                  <div>
                    {row.storeName}
                    <div className="secondary">{row.facilitySnapshot.zone}</div>
                  </div>
                ),
              },
              {
                title: "状态",
                dataIndex: "status",
                width: 120,
                render: (value: TicketStatus) => (
                  <Tag color={statusColors[value]}>{statusNames[value]}</Tag>
                ),
              },
              {
                title: "优先级",
                dataIndex: "priority",
                width: 90,
                render: (value) =>
                  value === "URGENT" ? (
                    <Tag color="red">紧急</Tag>
                  ) : (
                    <Text type="secondary">普通</Text>
                  ),
              },
              {
                title: "工程师",
                dataIndex: "assigneeName",
                width: 120,
                render: (value) =>
                  value || <Text type="secondary">待安排</Text>,
              },
              {
                title: "提交时间",
                dataIndex: "submittedAt",
                width: 140,
                render: (value) => dateTime(value),
              },
            ]}
          />
        )}
      </section>
      <Drawer
        title={
          ticket
            ? `${ticket.ticketNo} · ${statusNames[ticket.status]}`
            : "工单详情"
        }
        open={!!selectedId}
        width={780}
        onClose={() => navigate("/tickets")}
        loading={detailLoading}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void loadDetail()}>
            刷新
          </Button>
        }
      >
        {detailError ? (
          <Alert
            type="error"
            message={detailError}
            action={<Button onClick={() => void loadDetail()}>重试</Button>}
          />
        ) : (
          ticket && (
            <>
              {session.role === "HQ_ADMIN" && <TicketNextStep ticket={ticket} busy={actionBusy} onAction={item => void chooseAction(item)} />}
              <Space wrap className="ticket-action-bar">
                {[...ticket.allowedActions]
                  .sort((a, b) => actionRank(a) - actionRank(b))
                  .map((item, index) => (
                    <Button
                      key={item}
                      type={index === 0 && !(session.role === "HQ_ADMIN" && nextStep(ticket).action) ? "primary" : "default"}
                      danger={["reject", "cancel", "return"].includes(item)}
                      disabled={actionBusy}
                      onClick={() => void chooseAction(item)}
                    >
                      {actionNames[item]}
                    </Button>
                  ))}
              </Space>
              <Title level={4}>{ticket.title}</Title>
              <Paragraph className="preserve-lines">
                {ticket.description}
              </Paragraph>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2, xxl: 2 }}
                labelStyle={{ whiteSpace: "nowrap" }}
                size="small"
                items={[
                  { key: "store", label: "门店", children: ticket.storeName },
                  {
                    key: "category",
                    label: "报修分类",
                    children: ticket.categoryName,
                  },
                  {
                    key: "facility",
                    label: "故障设施",
                    children: ticket.facilitySnapshot.facilityName,
                  },
                  {
                    key: "zone",
                    label: "设施位置",
                    children: ticket.facilitySnapshot.zone,
                  },
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
                    key: "contact",
                    label: "门店联系人",
                    children: `${ticket.contactName} · ${ticket.contactPhone}`,
                  },
                  {
                    key: "engineer",
                    label: "工程师",
                    children: ticket.assigneeName || "待安排",
                  },
                ]}
              />
              <div className="spaced">
                <ImageGallery
                  images={ticket.attachments.filter(
                    (image) => image.purpose === "FAULT",
                  )}
                />
              </div>
              <MaterialsPanel ticket={ticket} onChanged={changed} />
              <Title level={5}>处理记录</Title>
              <Timeline
                items={events.map((event) => ({
                  color: event.toStatus === "COMPLETED" ? "green" : "blue",
                  children: (
                    <>
                      <strong>
                        {actionNames[event.action] || event.action}
                      </strong>
                      <div className="secondary">
                        {event.actorName} · {dateTime(event.createdAt)}
                      </div>
                      {event.note && (
                        <Paragraph className="preserve-lines">
                          {event.note}
                        </Paragraph>
                      )}
                      {event.payload.resultNote && (
                        <Paragraph className="preserve-lines">
                          {event.payload.resultNote}
                        </Paragraph>
                      )}
                      {event.payload.scheduledAt && (
                        <Paragraph>
                          预计上门：{dateTime(event.payload.scheduledAt)}
                        </Paragraph>
                      )}
                      <ImageGallery images={event.attachments} />
                    </>
                  ),
                }))}
              />
            </>
          )
        )}
      </Drawer>
      {creating && session.role === "STORE_MANAGER" && (
        <NewTicket
          session={session}
          onClose={() => navigate("/tickets")}
          onCreated={(id) => {
            navigate("/tickets/" + id);
            void load();
          }}
        />
      )}
      {action === "costs" && ticket && (
        <CostModal
          ticket={ticket}
          onClose={() => setAction(undefined)}
          onDone={changed}
        />
      )}
      {action && action !== "costs" && ticket && (
        <TicketAction
          ticket={ticket}
          action={action}
          session={session}
          onClose={() => setAction(undefined)}
          onReload={loadDetail}
          onDone={async () => {
            await Promise.all([loadDetail(), load()]);
          }}
        />
      )}
    </>
  );
}

