import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Empty,
  List,
  Pagination,
  Space,
  Typography,
} from "antd";
import { BellOutlined, ReloadOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { api, errorText } from "./api";
import { dateTime } from "./business";
type Notice = {
  id: string;
  ticketId: string | null;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};
type Feed = { items: Notice[]; unread: number; total: number };
export default function Notifications() {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<Feed>(),
    [open, setOpen] = useState(location.pathname === "/notifications"),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api<Feed>(`/repair/notifications?page=${page}&size=20`));
    } catch (err) {
      setError(errorText(err));
    }
  }, [page]);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load]);
  const read = async (ids: string[]) => {
    if (!ids.length) return;
    setBusy(true);
    setError("");
    try {
      await api("/repair/notifications/read", {
        method: "POST",
        body: { ids },
      });
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Badge count={Number(data?.unread || 0)} overflowCount={99}>
        <Button
          type="text"
          icon={<BellOutlined />}
          aria-label="查看通知"
          onClick={() => {
            setOpen(true);
            void load();
          }}
        />
      </Badge>
      <Drawer
        title="维修通知"
        open={open}
        width={430}
        onClose={() => setOpen(false)}
        extra={
          <Button
            icon={<ReloadOutlined />}
            aria-label="刷新通知"
            onClick={() => void load()}
          />
        }
      >
        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            action={<Button onClick={() => void load()}>重试</Button>}
          />
        )}
        <div className="notification-toolbar">
          <Typography.Text type="secondary">
            未读 {data?.unread || 0} 条
          </Typography.Text>
          <Button
            size="small"
            disabled={busy || !data?.items.some((row) => !row.read)}
            loading={busy}
            onClick={() =>
              void read(
                data?.items.filter((row) => !row.read).map((row) => row.id) ||
                  [],
              )
            }
          >
            本页标为已读
          </Button>
        </div>
        <List
          dataSource={data?.items || []}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无可见通知"
              />
            ),
          }}
          renderItem={(item) => (
            <List.Item>
              <div className={"notice " + (!item.read ? "unread" : "")}>
                <div className="notice-title">
                  {!item.read && <Badge status="processing" />}
                  <strong>{item.message}</strong>
                </div>
                <Typography.Text type="secondary">
                  {dateTime(item.createdAt)}
                </Typography.Text>
                <Space>
                  {item.ticketId && (
                    <Button
                      type="link"
                      size="small"
                      disabled={busy}
                      onClick={async () => {
                        if (!item.read) await read([item.id]);
                        setOpen(false);
                        navigate("/tickets/" + item.ticketId);
                      }}
                    >
                      查看工单
                    </Button>
                  )}
                  {!item.read && (
                    <Button
                      type="link"
                      size="small"
                      disabled={busy}
                      onClick={() => void read([item.id])}
                    >
                      标为已读
                    </Button>
                  )}
                </Space>
              </div>
            </List.Item>
          )}
        />
        <Pagination
          current={page}
          pageSize={20}
          total={Number(data?.total || 0)}
          showSizeChanger={false}
          size="small"
          onChange={setPage}
        />
      </Drawer>
    </>
  );
}
