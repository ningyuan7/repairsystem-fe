import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Drawer, Empty, Select, Space, Table, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { api, errorText, Page } from "./api";
import { dateTime, statusColors, statusNames, TicketStatus } from "./business";

const { Title, Text } = Typography;
type Engineer = {
  id: string; name: string; contactPhone: string; memberStatus: string;
  assigned: number; accepted: number; inProgress: number; waitingAcceptance: number; currentOpen: number;
};
type DispatchTicket = {
  id: string; ticketNo: string; title: string; storeName: string;
  priority: string; status: TicketStatus; assignedAt: string | null;
};
const activeStatuses: TicketStatus[] = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "WAITING_ACCEPTANCE"];
const count = (value: number) => Number(value).toLocaleString("zh-CN");

export default function EngineerDispatch({ refreshKey }: { refreshKey: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<Page<Engineer>>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError("");
    try {
      const result = await api<Page<Engineer>>(`/repair/dashboard/engineer-dispatch?page=${page}&size=10`);
      if (request !== generation.current) return;
      if (page > 1 && !result.items.length) {
        setPage(Math.max(1, Math.ceil(Number(result.total) / 10))); return;
      }
      setData(result);
    } catch (err) { if (request === generation.current) setError(errorText(err)); }
    finally { if (request === generation.current) setLoading(false); }
  }, [page]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load, refreshKey]);

  const [selected, setSelected] = useState<Engineer>();
  const [taskPage, setTaskPage] = useState(1);
  const [status, setStatus] = useState<TicketStatus>();
  const [tasks, setTasks] = useState<Page<DispatchTicket>>();
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState("");
  const taskGeneration = useRef(0);
  const loadTasks = useCallback(async () => {
    if (!selected) return;
    const request = ++taskGeneration.current;
    setTaskLoading(true); setTaskError("");
    const query = new URLSearchParams({ page: String(taskPage), size: "10" });
    if (status) query.set("status", status);
    try {
      const result = await api<Page<DispatchTicket>>(`/repair/dashboard/engineer-dispatch/${selected.id}/tickets?${query}`);
      if (request !== taskGeneration.current) return;
      if (taskPage > 1 && !result.items.length) { setTaskPage(1); return; }
      setTasks(result);
    } catch (err) { if (request === taskGeneration.current) setTaskError(errorText(err)); }
    finally { if (request === taskGeneration.current) setTaskLoading(false); }
  }, [selected, taskPage, status]);
  useEffect(() => { void loadTasks(); return () => { taskGeneration.current++; }; }, [loadTasks, refreshKey]);

  return <>
    <section className="work-panel table-panel engineer-dispatch" aria-labelledby="engineer-dispatch-heading">
      <div className="panel-heading">
        <div>
          <Title level={4} id="engineer-dispatch-heading">工程师派单一览</Title>
          <Text type="secondary">查看当前指派的未结任务，按未结总数排序。</Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} aria-label="刷新工程师派单" loading={loading} onClick={() => void load()}>刷新</Button>
          <Button type="primary" onClick={() => navigate("/tickets?status=READY_FOR_DISPATCH")}>去派单</Button>
        </Space>
      </div>
      {error && <Alert className="form-alert" type="error" showIcon message="工程师派单信息加载失败" description={error} action={<Button onClick={() => void load()}>重试</Button>} />}
      <Text type="secondary" className="dispatch-scroll-hint">左右滑动表格，查看各阶段数量与操作。</Text>
      <Table<Engineer>
        size="middle" rowKey="id" loading={loading} dataSource={data?.items ?? []} scroll={{ x: 930 }}
        pagination={{ current: page, pageSize: 10, total: Number(data?.total ?? 0), showSizeChanger: false, onChange: setPage, showTotal: total => `共 ${total} 位工程师` }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ? "请重试加载工程师派单信息" : "尚未添加工程师"}>{!error && <Button onClick={() => navigate("/hq/members")}>邀请工程师</Button>}</Empty> }}
        columns={[
          { title: "工程师", key: "engineer", width: 210, render: (_, row) => <><Text strong>{row.name || "未填写姓名"}</Text><div className="secondary">{row.contactPhone || "未填写联系电话"}</div></> },
          { title: "账号状态", dataIndex: "memberStatus", width: 100, render: value => <Tag color={value === "ACTIVE" ? "success" : "default"}>{value === "ACTIVE" ? "启用" : "停用"}</Tag> },
          { title: "待接单", dataIndex: "assigned", width: 90, align: "right", render: count },
          { title: "已接单", dataIndex: "accepted", width: 90, align: "right", render: count },
          { title: "维修中", dataIndex: "inProgress", width: 90, align: "right", render: count },
          { title: "待验收", dataIndex: "waitingAcceptance", width: 90, align: "right", render: count },
          { title: "未结总数", dataIndex: "currentOpen", width: 110, align: "right", render: value => <Text strong>{count(value)}</Text> },
          { title: "操作", key: "action", width: 140, render: (_, row) => <Button type="link" disabled={Number(row.currentOpen) === 0} aria-label={`查看${row.name || "工程师"}的派单`} onClick={() => { setTasks(undefined); setTaskPage(1); setStatus(undefined); setTaskError(""); setSelected(row); }}>查看任务</Button> },
        ]}
      />
    </section>
    <Drawer open={!!selected} width={900} title={`${selected?.name || "工程师"} · 当前派单`} onClose={() => { setSelected(undefined); setTasks(undefined); }}>
      <Text type="secondary">仅展示当前指派的待接单、已接单、维修中和待验收工单。</Text>
      <div className="table-toolbar engineer-dispatch-filters">
        <Select allowClear aria-label="筛选工程师工单状态" placeholder="全部未结状态" value={status} style={{ width: 180 }} options={activeStatuses.map(value => ({ value, label: statusNames[value] }))} onChange={value => { setTasks(undefined); setStatus(value); setTaskPage(1); }} />
        <Button icon={<ReloadOutlined />} loading={taskLoading} onClick={() => void loadTasks()}>刷新任务</Button>
      </div>
      {taskError && <Alert type="error" showIcon message={taskError} action={<Button onClick={() => void loadTasks()}>重试</Button>} className="form-alert" />}
      <Text type="secondary" className="dispatch-scroll-hint">左右滑动表格，查看工单状态与派单时间。</Text>
      <Table<DispatchTicket> size="middle" rowKey="id" loading={taskLoading} dataSource={tasks?.items ?? []} scroll={{ x: 740 }}
        pagination={{ current: taskPage, pageSize: 10, total: Number(tasks?.total ?? 0), showSizeChanger: false, onChange: value => { setTasks(undefined); setTaskPage(value); }, showTotal: total => `共 ${total} 张工单` }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={taskError ? "请重试加载任务" : "当前条件下暂无未结工单"} /> }}
        columns={[
          { title: "工单与门店", key: "title", width: 310, render: (_, row) => <><Button type="link" className="ticket-title" onClick={() => navigate("/tickets/" + row.id)}>{row.title}</Button><div className="secondary">{row.ticketNo} · {row.storeName}</div></> },
          { title: "状态", dataIndex: "status", width: 110, render: (value: TicketStatus) => <Tag color={statusColors[value]}>{statusNames[value]}</Tag> },
          { title: "优先级", dataIndex: "priority", width: 90, render: value => value === "URGENT" ? <Tag color="red">紧急</Tag> : "普通" },
          { title: "派单时间", dataIndex: "assignedAt", width: 170, render: dateTime },
        ]}
      />
    </Drawer>
  </>;
}
