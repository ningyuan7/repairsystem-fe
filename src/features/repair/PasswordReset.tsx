import { useEffect, useState } from "react";
import { Alert, Button, Form, Input, Modal, Result, Typography } from "antd";
import { api, errorText } from "./api";
export default function PasswordReset({ onClose }: { onClose: () => void }) {
  const [form] = Form.useForm(),
    [busy, setBusy] = useState(false),
    [sending, setSending] = useState(false),
    [wait, setWait] = useState(0),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  return (
    <Modal
      open
      title="找回登录密码"
      footer={null}
      onCancel={() => !busy && !sending && onClose()}
    >
      {done ? (
        <Result
          status="success"
          title="密码已更新"
          subTitle="请使用新密码重新登录。"
          extra={
            <Button type="primary" onClick={onClose}>
              返回登录
            </Button>
          }
        />
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            仅受邀成员可重置密码。需要系统已配置邮箱验证码；无法收信时请联系总部。
          </Typography.Paragraph>
          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              className="form-alert"
            />
          )}
          {sent && (
            <Alert
              type="success"
              showIcon
              message="验证码已发送，请检查工作邮箱。"
              className="form-alert"
            />
          )}
          <Form
            name="repair-password-reset"
            form={form}
            layout="vertical"
            requiredMark={false}
            disabled={busy}
            onFinish={async (values) => {
              setBusy(true);
              setError("");
              try {
                await api("/auth/password/reset", {
                  method: "POST",
                  anonymous: true,
                  body: {
                    identifierType: "EMAIL",
                    identifier: values.email,
                    code: values.code,
                    newPassword: values.password,
                  },
                });
                setDone(true);
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
              rules={[{ required: true, type: "email" }]}
            >
              <Input autoComplete="email" />
            </Form.Item>
            <Form.Item
              name="code"
              label="邮箱验证码"
              rules={[
                {
                  required: true,
                  pattern: /^[0-9]{6}$/,
                  message: "输入6位验证码",
                },
              ]}
            >
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    loading={sending}
                    disabled={busy || wait > 0}
                    onClick={async () => {
                      try {
                        const values = await form.validateFields(["email"]);
                        setSending(true);
                        setError("");
                        await api("/auth/send-code", {
                          method: "POST",
                          anonymous: true,
                          body: {
                            identifierType: "EMAIL",
                            identifier: values.email,
                            scene: "RESET_PASSWORD",
                          },
                        });
                        setSent(true);
                        setWait(60);
                      } catch (err) {
                        if (err instanceof Error) setError(errorText(err));
                      } finally {
                        setSending(false);
                      }
                    }}
                  >
                    {wait ? `${wait}秒后重发` : "发送验证码"}
                  </Button>
                }
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="新密码"
              rules={[
                {
                  required: true,
                  pattern: /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/,
                  message: "使用至少8位字母与数字，最多72个UTF-8字节",
                },
                {
                  validator: (_, value) =>
                    !value || new TextEncoder().encode(value).length <= 72
                      ? Promise.resolve()
                      : Promise.reject(new Error("密码最多72个UTF-8字节")),
                },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirmation"
              label="确认新密码"
              dependencies={["password"]}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    value === getFieldValue("password")
                      ? Promise.resolve()
                      : Promise.reject(new Error("两次输入的密码不同")),
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={busy}
              disabled={sending}
              block
            >
              更新密码
            </Button>
          </Form>
        </>
      )}
    </Modal>
  );
}
