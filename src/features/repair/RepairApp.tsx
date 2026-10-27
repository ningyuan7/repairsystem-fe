import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Avatar,
  Button,
  ConfigProvider,
  Drawer,
  Empty,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Result,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
const Tickets = lazy(() => import("./Tickets"));
const PurchaseWorkspace = lazy(() => import("./PurchaseWorkspace"));
import Dashboard from "./Dashboard";
const Reports = lazy(() => import("./Reports"));
import Notifications from "./Notifications";
const AssetRegistry = lazy(() =>
  import("./Assets").then((module) => ({ default: module.AssetRegistry })),
);
const CategoryRegistry = lazy(() =>
  import("./Assets").then((module) => ({ default: module.CategoryRegistry })),
);
import PasswordReset from "./PasswordReset";
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  DashboardOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  TeamOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import {
  api,
  ApiError,
  errorText,
  LoginResult,
  Member,
  Page,
  Role,
  roleNames,
  saveTokens,
  Session,
  Store,
  tokens,
} from "./api";
import "./repair.css";

const { Title, Text, Paragraph } = Typography;
type Screen =
  | "home"
  | "stores"
  | "members"
  | "tickets"
  | "assets"
  | "categories"
  | "purchase"
  | "reports";

function Login({ onLogin }: { onLogin: () => void }) {
  const [reset, setReset] = useState(location.pathname === "/password/reset");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="login-page">
      <aside className="login-intro">
        <div className="brand">
          <ToolOutlined />
          <strong>门店设施报修</strong>
        </div>
        <div>
          <span className="eyebrow">内部运营 · 设施维保</span>
          <h1>
            让每一次故障
            <br />
            都有处理的着落。
          </h1>
          <p>
            从门店上报，到总部协调、工程师维修和门店验收，保留完整的处理记录。
          </p>
          <ol>
            <li>门店发现并提交故障</li>
            <li>总部审核、采购与派单</li>
            <li>工程师维修，门店确认结果</li>
          </ol>
        </div>
        <small>仅限受邀成员使用</small>
      </aside>
      <main className="login-main">
        <div className="login-form">
          <Tag icon={<SafetyCertificateOutlined />} color="blue">
            内部成员入口
          </Tag>
          <Title level={2}>登录工作台</Title>
          <Paragraph type="secondary">请使用总部邀请开通的邮箱账号。</Paragraph>
          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              className="form-alert"
            />
          )}
          <Form
            name="repair-login"
            layout="vertical"
            requiredMark={false}
            onFinish={async (values) => {
              setBusy(true);
              setError("");
              try {
                const result = await api<LoginResult>("/auth/login", {
                  method: "POST",
                  anonymous: true,
                  body: {
                    identifierType: "EMAIL",
                    identifier: values.email,
                    password: values.password,
                  },
                });
                saveTokens(result.token);
                onLogin();
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Form.Item
              name="email"
              label="工作邮箱"
              rules={[
                {
                  required: true,
                  type: "email",
                  message: "请输入有效的邮箱地址",
                },
              ]}
            >
              <Input
                size="large"
                placeholder="name@example.com"
                autoComplete="username"
                autoFocus
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password
                size="large"
                autoComplete="current-password"
                placeholder="请输入登录密码"
              />
            </Form.Item>
            <Button
              block
              size="large"
              type="primary"
              htmlType="submit"
              loading={busy}
            >
              登录
            </Button>
          </Form>
          <p className="login-help">
            还没有账号或忘记密码？请联系总部管理员。
            <br />
            已有邀请链接，请通过邀请链接激活账号。
          </p>
          <Button type="link" onClick={() => setReset(true)}>
            找回密码
          </Button>
          {reset && <PasswordReset onClose={() => setReset(false)} />}
        </div>
      </main>
    </div>
  );
}

function Activation({ onBack }: { onBack: () => void }) {
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  const [preview, setPreview] = useState<{
    email: string;
    role: Role;
    expiresAt: string;
    existingAccount: boolean;
  }>();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      setPreview(
        await api("/repair/invitations/preview", {
          method: "POST",
          anonymous: true,
          body: { token },
        }),
      );
    } catch (err) {
      setError(errorText(err));
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="activation-page">
      <div className="activation-panel">
        <div className="brand">
          <ToolOutlined />
          <strong>门店设施报修</strong>
        </div>
        {done ? (
          <Result
            status="success"
            title="账号已激活"
            subTitle="现在可以使用邀请邮箱和密码登录。"
            extra={
              <Button type="primary" onClick={onBack}>
                前往登录
              </Button>
            }
          />
        ) : (
          <>
            <Title level={3}>接受内部邀请</Title>
            {error && (
              <Alert
                showIcon
                type="error"
                message={error}
                action={
                  !preview ? (
                    <Button size="small" onClick={() => void load()}>
                      重试
                    </Button>
                  ) : undefined
                }
              />
            )}
            {!preview && !error && <Spin />}
            {preview && (
              <>
                <Paragraph>
                  邀请邮箱：<strong>{preview.email}</strong>
                  <br />
                  加入身份：{roleNames[preview.role]}
                </Paragraph>
                <Alert
                  type="info"
                  showIcon
                  message={
                    preview.existingAccount
                      ? "此邮箱已有账号，请输入原密码验证身份；邀请不会修改原密码。"
                      : "设置显示姓名和登录密码，即可加入内部系统。"
                  }
                />
                <Form
                  layout="vertical"
                  requiredMark={false}
                  className="spaced"
                  onFinish={async (values) => {
                    setBusy(true);
                    setError("");
                    try {
                      let proof: LoginResult | undefined;
                      if (preview.existingAccount)
                        proof = await api<LoginResult>("/auth/login", {
                          method: "POST",
                          anonymous: true,
                          invitation: token,
                          body: {
                            identifierType: "EMAIL",
                            identifier: preview.email,
                            password: values.password,
                          },
                        });
                      if (proof) saveTokens(proof.token);
                      await api("/repair/invitations/accept", {
                        method: "POST",
                        anonymous: !proof,
                        body: {
                          token,
                          displayName: values.displayName,
                          ...(preview.existingAccount
                            ? {}
                            : { password: values.password }),
                        },
                      });
                      saveTokens(null);
                      history.replaceState(null, "", "/activate");
                      setDone(true);
                    } catch (err) {
                      setError(errorText(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Form.Item
                    name="displayName"
                    label="显示姓名"
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        max: 64,
                        message: "请输入姓名，不超过 64 字",
                      },
                    ]}
                  >
                    <Input autoComplete="name" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    label={preview.existingAccount ? "原账号密码" : "设置密码"}
                    rules={[
                      {
                        required: true,
                        min: preview.existingAccount ? 1 : 8,
                        message: "密码至少 8 位，包含字母和数字",
                      },
                    ]}
                  >
                    <Input.Password
                      autoComplete={
                        preview.existingAccount
                          ? "current-password"
                          : "new-password"
                      }
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={busy} block>
                    验证并激活账号
                  </Button>
                </Form>
              </>
            )}
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={onBack}>
              返回登录
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Shell({
  session,
  refresh,
  signOut,
}: {
  session: Session;
  refresh: () => Promise<void>;
  signOut: () => void;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const screen: Screen = location.pathname.startsWith("/hq/reports")
    ? "reports"
    : location.pathname.startsWith("/tickets") ||
        location.pathname.startsWith("/engineer/tasks")
      ? "tickets"
      : location.pathname.includes("members")
        ? "members"
        : location.pathname.startsWith("/stores")
          ? "stores"
          : location.pathname.startsWith("/assets")
            ? "assets"
            : location.pathname.includes("categories")
              ? "categories"
              : location.pathname.startsWith("/hq/purchases/")
                ? "purchase"
                : "home";
  const setScreen = (value: Screen) =>
    navigate(
      value === "home"
        ? "/"
        : value === "members"
          ? "/hq/members"
          : value === "reports"
            ? "/hq/reports"
            : value === "categories"
              ? "/hq/categories"
              : "/" + value,
    );
  const [profileBusy, setProfileBusy] = useState(false),
    [profileError, setProfileError] = useState("");
  const [profileOpen, setProfileOpen] = useState(
    location.pathname === "/profile",
  );
  const hq = session.role === "HQ_ADMIN";
  const nav = [
    { key: "home", icon: <DashboardOutlined />, label: "工作台" },
    {
      key: "tickets",
      icon: <ToolOutlined />,
      label: session.role === "ENGINEER" ? "我的维修任务" : "工单工作台",
    },
    ...(hq
      ? [{ key: "reports", icon: <DashboardOutlined />, label: "数据汇总" }]
      : []),
    ...(session.role !== "ENGINEER"
      ? [{ key: "assets", icon: <ApartmentOutlined />, label: "设施管理" }]
      : []),
    ...(hq
      ? [{ key: "categories", icon: <ApartmentOutlined />, label: "报修分类" }]
      : []),
    ...(session.role !== "ENGINEER"
      ? [
          {
            key: "stores",
            icon: <ShopOutlined />,
            label: hq ? "门店管理" : "负责门店",
          },
        ]
      : []),
    ...(hq
      ? [{ key: "members", icon: <TeamOutlined />, label: "成员与权限" }]
      : []),
  ];
  const restricted = (!hq && ["members", "categories", "reports", "purchase"].includes(screen)) ||
    (session.role === "ENGINEER" && ["assets", "stores"].includes(screen));
  // Resolve stale links and an earlier account's page before restricted children can mount or fetch data.
  if (restricted) return <Navigate to="/" replace />;
  return (
    <Layout className="repair-shell">
      <Layout.Sider
        width={224}
        className="repair-sidebar"
        breakpoint="lg"
        collapsedWidth={0}
      >
        <div className="brand">
          <ToolOutlined />
          <strong>门店设施报修</strong>
        </div>
        <span className="nav-caption">运营管理</span>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[screen === "purchase" ? "tickets" : screen]}
          items={nav}
          onClick={({ key }) => setScreen(key as Screen)}
        />
        <div className="sidebar-footer">
          <SafetyCertificateOutlined /> 内部协作空间
        </div>
      </Layout.Sider>
      <Layout>
        <header className="repair-header">
          <div className="mobile-brand">
            <ToolOutlined /> 门店设施报修
          </div>
          <span className="header-caption">
            {hq ? "总部管理中心" : roleNames[session.role]}
          </span>
          <Space size={12}>
            {session.repairProfileComplete && <Notifications />}
            <Button
              type="text"
              aria-label="编辑工作资料"
              onClick={() => setProfileOpen(true)}
            >
              <Avatar style={{ background: "#e9edff", color: "#3158d5" }}>
                {session.displayName.slice(0, 1)}
              </Avatar>
            </Button>
            <span className="account-name">{session.displayName}</span>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={signOut}
              aria-label="退出登录"
            >
              退出
            </Button>
          </Space>
        </header>
        <main className="repair-main">
          <Suspense
            fallback={
              <div className="full-state">
                <Spin />
                <p>正在加载工作页面…</p>
              </div>
            }
          >
            {session.repairProfileComplete && screen === "home" && (
              <Dashboard session={session} />
            )}
            {session.repairProfileComplete && screen === "reports" && hq && (
              <Reports session={session} />
            )}
            {session.repairProfileComplete && screen === "stores" && (
              <Stores session={session} changed={refresh} />
            )}
            {session.repairProfileComplete && screen === "tickets" && (
              <Tickets session={session} />
            )}
            {session.repairProfileComplete && screen === "purchase" && hq && (
              <PurchaseWorkspace session={session} />
            )}
            {session.repairProfileComplete &&
              screen === "assets" &&
              session.role !== "ENGINEER" && (
                <AssetRegistry session={session} />
              )}
            {session.repairProfileComplete && screen === "categories" && hq && (
              <CategoryRegistry />
            )}
            {session.repairProfileComplete && screen === "members" && hq && (
              <Members session={session} />
            )}
          </Suspense>
        </main>
      </Layout>
      <Modal
        title="完善你的工作资料"
        open={!session.repairProfileComplete || profileOpen}
        closable={session.repairProfileComplete && !profileBusy}
        onCancel={() => setProfileOpen(false)}
        maskClosable={false}
        footer={null}
      >
        <Paragraph type="secondary">
          保存显示姓名后进入工作台。联系电话可选。
        </Paragraph>
        {profileError && <Alert type="error" message={profileError} />}
        <Form
          name="repair-work-profile"
          layout="vertical"
          initialValues={{
            displayName: session.displayName,
            contactPhone: session.contactPhone,
          }}
          onFinish={async (values) => {
            setProfileBusy(true);
            setProfileError("");
            try {
              await api("/repair/me/profile", {
                method: "PATCH",
                body: { ...values, expectedVersion: session.memberVersion },
              });
              await refresh();
              setProfileOpen(false);
            } catch (err) {
              setProfileError(errorText(err));
            } finally {
              setProfileBusy(false);
            }
          }}
        >
          <Form.Item
            name="displayName"
            label="显示姓名"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input autoComplete="name" />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话" rules={[{ max: 32 }]}>
            <Input autoComplete="tel" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={profileBusy} block>
            保存并进入
          </Button>
        </Form>
      </Modal>
    </Layout>
  );
}

function Stores({
  session,
  changed,
}: {
  session: Session;
  changed: () => Promise<void>;
}) {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Store[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<Store | null | undefined>(),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState("");
  const [form] = Form.useForm();
  const hq = session.role === "HQ_ADMIN";
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<Page<Store>>(
        `/repair/stores?page=${page}&size=20`,
      );
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  const edit = (store: Store | null) => {
    setEditing(store);
    setSaveError("");
    form.setFieldsValue(
      store || {
        code: "",
        name: "",
        region: "",
        address: "",
        status: "ACTIVE",
      },
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">门店目录</span>
          <Title level={2}>{hq ? "门店管理" : "负责门店"}</Title>
          <Text type="secondary">
            {hq
              ? "维护门店信息与启用状态，为报修和人员授权建立范围。"
              : "仅展示总部授权给你的门店。"}
          </Text>
        </div>
        {hq && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => edit(null)}
          >
            新增门店
          </Button>
        )}
      </div>
      <section className="work-panel table-panel">
        <div className="table-toolbar">
          <strong>
            门店列表 <span className="count">{total}</span>
          </strong>
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
            loading={loading}
            dataSource={rows}
            scroll={{ x: 750 }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    hq
                      ? "暂无门店，先新增第一家门店"
                      : "尚未获得门店授权，请联系总部"
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              showSizeChanger: false,
              onChange: setPage,
            }}
            columns={[
              {
                title: "门店",
                key: "store",
                width: 240,
                render: (_, row: Store) => (
                  <div>
                    <strong>{row.name}</strong>
                    <div className="secondary">{row.code}</div>
                  </div>
                ),
              },
              {
                title: "区域",
                dataIndex: "region",
                width: 110,
                render: (value) => value || "未填写",
              },
              {
                title: "地址",
                dataIndex: "address",
                ellipsis: true,
                render: (value) => value || "未填写",
              },
              {
                title: "状态",
                dataIndex: "status",
                width: 100,
                render: (value) => (
                  <Tag color={value === "ACTIVE" ? "green" : "default"}>
                    {value === "ACTIVE" ? "启用" : "停用"}
                  </Tag>
                ),
              },
              ...(hq
                ? [
                    {
                      title: "操作",
                      key: "action",
                      width: 90,
                      render: (_: unknown, row: Store) => (
                        <Button type="link" onClick={() => edit(row)}>
                          编辑
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </section>
      <Drawer
        title={editing ? "编辑门店" : "新增门店"}
        open={editing !== undefined}
        onClose={() => !busy && setEditing(undefined)}
        width={480}
        extra={
          <Button type="primary" loading={busy} onClick={() => form.submit()}>
            保存
          </Button>
        }
      >
        <Paragraph type="secondary">
          门店编号用于内部识别；停用后将停止接受新的门店授权。
        </Paragraph>
        {saveError && (
          <Alert
            showIcon
            type="error"
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
              await api("/repair/stores" + (editing ? "/" + editing.id : ""), {
                method: editing ? "PUT" : "POST",
                body: {
                  ...values,
                  ...(editing ? { expectedVersion: editing.version } : {}),
                },
              });
              setEditing(undefined);
              void message.success("门店已保存");
              await load();
              await changed();
            } catch (err) {
              setSaveError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Form.Item
            name="code"
            label="门店编号"
            rules={[
              {
                required: true,
                pattern: /^[A-Za-z0-9_-]{1,32}$/,
                message: "使用 1–32 位字母、数字、下划线或短横线",
              },
            ]}
          >
            <Input placeholder="例如 SH-001" />
          </Form.Item>
          <Form.Item
            name="name"
            label="门店名称"
            rules={[{ required: true, whitespace: true, max: 128 }]}
          >
            <Input placeholder="例如 上海徐汇店" />
          </Form.Item>
          <Form.Item name="region" label="所属区域" rules={[{ max: 64 }]}>
            <Input placeholder="例如 华东区域" />
          </Form.Item>
          <Form.Item name="address" label="详细地址" rules={[{ max: 255 }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="status"
            label="门店状态"
            rules={[{ required: true }]}
          >
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

function Members({ session }: { session: Session }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Member[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [stores, setStores] = useState<Store[]>([]),
    [editing, setEditing] = useState<Member>(),
    [inviting, setInviting] = useState(false),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState("");
  const [created, setCreated] = useState<{
      activationPath: string;
      expiresAt: string;
    }>(),
    [statusTarget, setStatusTarget] = useState<Member>();
  const [form] = Form.useForm(),
    [statusForm] = Form.useForm();
  const selectedRole = Form.useWatch("role", form);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<Page<Member>>(
        `/repair/members?page=${page}&size=20`,
      );
      setRows(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  const open = async (member?: Member) => {
    setSaveError("");
    form.resetFields();
    form.setFieldsValue(
      member
        ? {
            role: member.role,
            storeIds: member.stores.map((s) => s.id),
            reason: "",
          }
        : { role: "STORE_MANAGER", storeIds: [] },
    );
    setEditing(member);
    setInviting(!member);
    try {
      const all: Store[] = [];
      let next = 1,
        data: Page<Store>;
      do {
        data = await api<Page<Store>>(`/repair/stores?page=${next++}&size=100`);
        all.push(...data.items);
      } while (all.length < data.total);
      setStores(all);
    } catch (err) {
      setSaveError(errorText(err));
    }
  };
  const invitationLink = created
    ? location.origin + created.activationPath
    : "";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">组织与访问控制</span>
          <Title level={2}>成员与权限</Title>
          <Text type="secondary">按工作职责分配角色，按门店限制数据范围。</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => void open()}
        >
          邀请成员
        </Button>
      </div>
      <Alert
        className="scope-note"
        type="info"
        showIcon
        message="总部查看全部门店；门店管理员仅查看授权门店；工程师仅访问当前指派给本人的工单。"
      />
      <section className="work-panel table-panel">
        <div className="table-toolbar">
          <strong>
            内部成员 <span className="count">{total}</span>
          </strong>
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
            loading={loading}
            dataSource={rows}
            scroll={{ x: 930 }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无成员"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              showSizeChanger: false,
              onChange: setPage,
            }}
            columns={[
              {
                title: "成员",
                key: "name",
                width: 240,
                render: (_, row: Member) => (
                  <div>
                    <strong>{row.displayName || "待完善姓名"}</strong>
                    {row.id === session.id && (
                      <Tag className="self-tag">本人</Tag>
                    )}
                    <div className="secondary">{row.email}</div>
                  </div>
                ),
              },
              {
                title: "角色",
                dataIndex: "role",
                width: 130,
                render: (role: Role) => (
                  <Tag
                    color={
                      role === "HQ_ADMIN"
                        ? "blue"
                        : role === "ENGINEER"
                          ? "cyan"
                          : "default"
                    }
                  >
                    {roleNames[role]}
                  </Tag>
                ),
              },
              {
                title: "数据范围",
                key: "scope",
                render: (_, row: Member) =>
                  row.role === "HQ_ADMIN" ? (
                    "全部门店"
                  ) : row.role === "ENGINEER" ? (
                    "本人当前工单"
                  ) : (
                    <span title={row.stores.map((s) => s.name).join("、")}>
                      {row.stores.map((s) => s.name).join("、") || "未授权门店"}
                    </span>
                  ),
              },
              {
                title: "状态",
                dataIndex: "status",
                width: 90,
                render: (value) => (
                  <span
                    className={
                      "status-dot " + (value === "ACTIVE" ? "active" : "")
                    }
                  >
                    {value === "ACTIVE" ? "正常" : "停用"}
                  </span>
                ),
              },
              {
                title: "操作",
                key: "actions",
                width: 170,
                render: (_, row: Member) => (
                  <Space size={0}>
                    <Button type="link" onClick={() => void open(row)}>
                      调整权限
                    </Button>
                    <Button
                      type="link"
                      danger={row.status === "ACTIVE"}
                      onClick={() => {
                        setSaveError("");
                        statusForm.resetFields();
                        setStatusTarget(row);
                      }}
                    >
                      {row.status === "ACTIVE" ? "停用" : "启用"}
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </section>
      <Drawer
        open={inviting || !!editing}
        title={editing ? "调整成员权限" : "邀请内部成员"}
        width={500}
        onClose={() => {
          if (!busy) {
            setEditing(undefined);
            setInviting(false);
          }
        }}
        extra={
          <Button type="primary" loading={busy} onClick={() => form.submit()}>
            {editing ? "保存权限" : "生成邀请链接"}
          </Button>
        }
      >
        <Paragraph type="secondary">
          {editing
            ? `正在调整 ${editing.displayName} 的权限。保存后原会话立即失效，成员需要重新登录。`
            : "邀请链接 72 小时有效，仅可激活一次。请通过你认可的渠道交给对应同事。"}
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
          requiredMark={false}
          onFinish={async (values) => {
            setBusy(true);
            setSaveError("");
            try {
              const body = {
                ...values,
                storeIds:
                  values.role === "STORE_MANAGER" ? values.storeIds : [],
              };
              if (editing) {
                await api("/repair/members/" + editing.id + "/access", {
                  method: "PUT",
                  body: { ...body, expectedVersion: editing.version },
                });
                void message.success("权限已更新，原会话已撤销");
              } else {
                setCreated(
                  await api("/repair/invitations", { method: "POST", body }),
                );
              }
              setEditing(undefined);
              setInviting(false);
              await load();
            } catch (err) {
              setSaveError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {!editing && (
            <Form.Item
              name="email"
              label="邀请邮箱"
              rules={[{ required: true, type: "email", max: 128 }]}
            >
              <Input placeholder="同事的工作邮箱" />
            </Form.Item>
          )}
          <Form.Item name="role" label="业务角色" rules={[{ required: true }]}>
            <Select
              options={(editing
                ? ["HQ_ADMIN", "STORE_MANAGER", "ENGINEER"]
                : ["STORE_MANAGER", "ENGINEER"]
              ).map((role) => ({
                value: role,
                label: roleNames[role as Role],
              }))}
            />
          </Form.Item>
          <Form.Item
            name="storeIds"
            label="负责门店"
            hidden={selectedRole !== "STORE_MANAGER"}
            rules={[
              {
                validator: (_, value) =>
                  selectedRole === "STORE_MANAGER" && !value?.length
                    ? Promise.reject(new Error("至少选择一家门店"))
                    : Promise.resolve(),
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="选择授权门店"
              optionFilterProp="label"
              options={stores
                .filter((s) => s.status === "ACTIVE")
                .map((s) => ({ value: s.id, label: `${s.name} · ${s.code}` }))}
            />
          </Form.Item>
          {editing && (
            <Form.Item
              name="reason"
              label="调整原因"
              rules={[{ required: true, whitespace: true, max: 500 }]}
            >
              <Input.TextArea rows={3} placeholder="说明职责或门店范围变化" />
            </Form.Item>
          )}
        </Form>
      </Drawer>
      <Modal
        title="邀请链接已生成"
        open={!!created}
        onCancel={() => setCreated(undefined)}
        footer={
          <Button type="primary" onClick={() => setCreated(undefined)}>
            完成
          </Button>
        }
      >
        <Alert
          type="success"
          showIcon
          message="链接已生成，请复制后交给对应同事。"
        />
        <Paragraph className="spaced">
          有效期至：
          {created &&
            new Date(created.expiresAt).toLocaleString("zh-CN", {
              timeZone: "Asia/Shanghai",
            })}
        </Paragraph>
        <Input.TextArea
          readOnly
          value={invitationLink}
          rows={3}
          aria-label="邀请链接"
        />
        <Button
          className="spaced"
          icon={<CopyOutlined />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(invitationLink);
              void message.success("已复制邀请链接");
            } catch {
              void message.info("浏览器无法自动复制，请选中上方链接手动复制");
            }
          }}
        >
          复制链接
        </Button>
      </Modal>
      <Modal
        title={statusTarget?.status === "ACTIVE" ? "停用成员" : "启用成员"}
        open={!!statusTarget}
        confirmLoading={busy}
        onCancel={() => !busy && setStatusTarget(undefined)}
        onOk={() => statusForm.submit()}
        okText="确认操作"
      >
        <Paragraph>
          {statusTarget?.displayName}：
          {statusTarget?.status === "ACTIVE"
            ? "停用后将立即无法访问系统，已有业务记录继续保留。"
            : "启用后需要重新登录。"}
        </Paragraph>
        {saveError && <Alert type="error" showIcon message={saveError} />}
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!statusTarget) return;
            setBusy(true);
            setSaveError("");
            try {
              await api(
                `/repair/members/${statusTarget.id}/${statusTarget.status === "ACTIVE" ? "disable" : "enable"}`,
                {
                  method: "POST",
                  body: { ...values, expectedVersion: statusTarget.version },
                },
              );
              setStatusTarget(undefined);
              void message.success("成员状态已更新");
              await load();
            } catch (err) {
              setSaveError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
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

function Root() {
  const route = useLocation(),
    navigate = useNavigate();
  const [session, setSession] = useState<Session>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const activating = route.pathname === "/activate";
  const restore = useCallback(async () => {
    setLoading(true);
    setError("");
    if (!tokens()) {
      setSession(undefined);
      setLoading(false);
      return;
    }
    try {
      setSession(await api<Session>("/repair/session"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        saveTokens(null);
        setSession(undefined);
      } else setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void restore();
    const expired = () => {
      setSession(undefined);
      setError("");
    };
    window.addEventListener("repair-auth-expired", expired);
    return () => window.removeEventListener("repair-auth-expired", expired);
  }, [restore]);
  const signOut = () => {
    const refreshToken = tokens()?.refreshToken;
    saveTokens(null);
    setSession(undefined);
    setError("");
    navigate("/", { replace: true });
    if (refreshToken)
      void api("/auth/logout", {
        method: "POST",
        anonymous: true,
        body: { refreshToken },
      }).catch(() => {});
  };
  if (activating)
    return (
      <Activation
        onBack={() => {
          navigate("/", { replace: true });
          void restore();
        }}
      />
    );
  if (loading)
    return (
      <div className="full-state">
        <Spin size="large" />
        <p>正在恢复内部工作会话…</p>
      </div>
    );
  if (error)
    return (
      <div className="full-state">
        <Result
          status="warning"
          title="暂时无法进入工作台"
          subTitle={error}
          extra={
            <Space>
              <Button type="primary" onClick={() => void restore()}>
                重新加载
              </Button>
              <Button onClick={signOut}>返回登录</Button>
            </Space>
          }
        />
      </div>
    );
  return session ? (
    <Shell
      session={session}
      refresh={async () => setSession(await api<Session>("/repair/session"))}
      signOut={signOut}
    />
  ) : (
    <Login onLogin={() => void restore()} />
  );
}
export default function RepairApp() {
  return (
    <ConfigProvider
      locale={zhCN}
      button={{ autoInsertSpace: false }}
      theme={{
        token: {
          colorPrimary: "#3158d5",
          borderRadius: 8,
          fontSize: 14,
          fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
          colorText: "#1f2937",
          colorBgLayout: "#f4f6fa",
        },
        components: {
          Table: { headerBg: "#f8f9fc", cellPaddingBlock: 15 },
          Menu: { darkItemBg: "#172239", darkItemSelectedBg: "#2c4170" },
        },
      }}
    >
      <App>
        <Root />
      </App>
    </ConfigProvider>
  );
}
