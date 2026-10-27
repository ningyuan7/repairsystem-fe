import { useEffect, useRef, useState } from "react";
import { Alert, Button, Image, Space, Spin, Typography } from "antd";
import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { api, errorText } from "./api";
import { Attachment } from "./business";

export function PrivateImage({
  id,
  large = false,
}: {
  id: string;
  large?: boolean;
}) {
  const [source, setSource] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      url = "";
    api<Blob>(`/repair/attachments/${id}/content`, { responseType: "blob" })
      .then((blob) => {
        if (alive) {
          url = URL.createObjectURL(blob);
          setSource(url);
        }
      })
      .catch((err) => alive && setError(errorText(err)));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return error ? (
    <Typography.Text type="danger">图片暂不可读</Typography.Text>
  ) : source ? (
    <Image
      src={source}
      width={large ? "100%" : 88}
      height={large ? undefined : 72}
      style={{ objectFit: large ? "contain" : "cover", borderRadius: 6 }}
      alt="授权维修图片"
    />
  ) : (
    <div className="image-loading">
      <Spin size="small" />
    </div>
  );
}
export function ImageGallery({ images }: { images: Attachment[] }) {
  const [expanded, setExpanded] = useState(false);
  return images.length ? (
    <div className="private-gallery">
      {!expanded ? (
        <Button size="small" onClick={() => setExpanded(true)}>
          查看照片（{images.length}）
        </Button>
      ) : (
        <Image.PreviewGroup>
          <Space wrap>
            {images.map((image) => (
              <PrivateImage key={image.id} id={image.id} />
            ))}
          </Space>
        </Image.PreviewGroup>
      )}
    </div>
  ) : null;
}
export function ImageField({
  value = [],
  onChange,
  purpose,
  storeId,
  ticketId,
  onBusyChange,
  purchaseOrderId,
  maxFiles = 6,
}: {
  value?: string[];
  onChange?: (ids: string[]) => void;
  purpose: "FAULT" | "RESULT" | "WORK_RECORD" | "ORDER_SCREENSHOT" | "RECEIPT";
  storeId?: string;
  ticketId?: string;
  purchaseOrderId?: string;
  maxFiles?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    keys = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <Image.PreviewGroup>
        <Space wrap>
          {value.map((id) => (
            <div className="upload-preview" key={id}>
              <PrivateImage id={id} />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                disabled={busy}
                aria-label="移除图片"
                onClick={() => onChange?.(value.filter((item) => item !== id))}
              />
            </div>
          ))}
        </Space>
      </Image.PreviewGroup>
      {error && (
        <Alert type="error" showIcon message={error} className="form-alert" />
      )}
      <input
        ref={input}
        type="file"
        style={{ display: "none" }}
        accept="image/jpeg,image/png"
        hidden
        multiple
        aria-label={
          purpose === "ORDER_SCREENSHOT"
            ? "选择订单截图"
            : purpose === "RECEIPT"
              ? "选择收货凭证"
              : "选择维修图片"
        }
        onChange={async (event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = "";
          if (!files.length) return;
          if (value.length + files.length > maxFiles) {
            setError(`本次最多可添加 ${maxFiles} 张图片`);
            return;
          }
          setBusy(true);
          onBusyChange?.(true);
          setError("");
          const uploaded = [...value];
          try {
            for (const file of files) {
              if (
                !["image/png", "image/jpeg"].includes(file.type) ||
                !file.size ||
                file.size > 5 * 1024 * 1024
              )
                throw new Error("请选择 5 MiB 以内的 JPG、PNG 图片");
              const hash = Array.from(
                new Uint8Array(
                  await crypto.subtle.digest(
                    "SHA-256",
                    await file.arrayBuffer(),
                  ),
                ),
              )
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
              const signature =
                purpose + storeId + ticketId + purchaseOrderId + hash;
              if (!keys.current.has(signature))
                keys.current.set(signature, crypto.randomUUID());
              const body = new FormData();
              body.set("file", file);
              body.set("purpose", purpose);
              if (storeId) body.set("storeId", storeId);
              if (ticketId) body.set("ticketId", ticketId);
              if (purchaseOrderId) body.set("purchaseOrderId", purchaseOrderId);
              const result = await api<Attachment>("/repair/attachments", {
                method: "POST",
                body,
                idempotencyKey: keys.current.get(signature),
              });
              keys.current.delete(signature);
              uploaded.push(result.id);
              onChange?.([...new Set(uploaded)]);
            }
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
            onBusyChange?.(false);
          }
        }}
      />
      <Button
        icon={<PlusOutlined />}
        loading={busy}
        disabled={
          value.length >= maxFiles ||
          (!storeId && !ticketId && !purchaseOrderId)
        }
        onClick={() => input.current?.click()}
      >
        {busy ? "正在上传" : "添加照片"}
      </Button>
      <div className="secondary">
        最多 6 张 JPG / PNG，单张不超过 5 MiB。图片仅供有权限的成员查看。
      </div>
    </div>
  );
}
