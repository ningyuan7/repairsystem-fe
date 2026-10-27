import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Collapse,
  Empty,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { api, errorText } from "./api";
import { PurchaseOrder } from "./business";
const { Text, Paragraph } = Typography;
type Field<T> = {
  value: T;
  evidence: string;
  confidence: number | null;
  lineIndexes: number[];
};
export type OcrItem = {
  name: Field<string> | null;
  brand: Field<string> | null;
  model: Field<string> | null;
  quantity: Field<number> | null;
  unitPrice: Field<string> | null;
};
export type OcrCandidates = {
  orderNumber: Field<string> | null;
  supplier: Field<string> | null;
  orderedAt: Field<string> | null;
  adjustmentAmount: Field<string> | null;
  sourceTotal: Field<string> | null;
  items: OcrItem[];
};
type Job = {
  jobId: string;
  attachmentId: string;
  status: string;
  version: number;
  errorCode: string | null;
  result: {
    candidates: OcrCandidates;
    lines: {
      text: string;
      confidence: number | null;
      polygon: { x: number; y: number }[];
    }[];
    warnings: string[];
  } | null;
};
const statusNames: Record<string, string> = {
  QUEUED: "等待识别",
  RUNNING: "正在识别",
  SUCCEEDED: "识别完成",
  FAILED: "识别失败",
  CANCELLED: "任务已取消",
};
function Value({
  label,
  field,
}: {
  label: string;
  field: Field<string | number> | null;
}) {
  return (
    <div className="ocr-value">
      <Text type="secondary">{label}</Text>
      <strong>{field ? String(field.value) : "未识别，请手填"}</strong>
      {field && (
        <div className="secondary">
          原文：{field.evidence} ·{" "}
          {field.confidence === null
            ? "未提供置信度"
            : `置信度 ${Math.round(field.confidence * 100)}%`}
        </div>
      )}
    </div>
  );
}

export default function OcrPanel({
  order,
  onMetadata,
  onItem,
}: {
  order: PurchaseOrder;
  onMetadata: (data: OcrCandidates) => void;
  onItem: (jobId: string, index: number, item: OcrItem) => void;
}) {
  const [availability, setAvailability] = useState<{ configured: boolean }>(),
    [jobs, setJobs] = useState<Job[]>([]),
    [selected, setSelected] = useState<string>(),
    [source, setSource] = useState<string>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const job = jobs.find((row) => row.jobId === selected),
    editable = order.status === "DRAFT";
  const load = useCallback(async () => {
    setError("");
    try {
      const [config, rows] = await Promise.all([
        api<{ configured: boolean }>("/repair/ocr/availability"),
        api<Job[]>(`/repair/purchase-orders/${order.id}/ocr-jobs`),
      ]);
      setAvailability(config);
      setJobs(rows);
      setSelected((current) => current || rows[0]?.jobId);
      setSource((current) => current || order.screenshots[0]?.id);
    } catch (err) {
      setError(errorText(err));
    }
  }, [order.id, order.screenshots.length]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!job || !["QUEUED", "RUNNING"].includes(job.status)) return;
    let live = true;
    const timer = setInterval(() => {
      api<Job>("/repair/ocr-jobs/" + job.jobId)
        .then(
          (data) =>
            live &&
            setJobs((rows) =>
              rows.map((row) => (row.jobId === data.jobId ? data : row)),
            ),
        )
        .catch((err) => {
          if (live) {
            setError(errorText(err));
            clearInterval(timer);
          }
        });
    }, 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [job?.jobId, job?.status]);
  const run = async (retry = false) => {
    if (!source && !retry) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Job>(
        retry
          ? `/repair/ocr-jobs/${job!.jobId}/retry`
          : `/repair/purchase-orders/${order.id}/ocr-jobs`,
        {
          method: "POST",
          body: retry
            ? { expectedVersion: job!.version }
            : { attachmentId: source },
        },
      );
      setJobs((rows) => [data, ...rows]);
      setSelected(data.jobId);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ocr-panel">
      <div className="form-section-heading">
        <strong>识别订单信息</strong>
        <Button size="small" onClick={() => void load()} disabled={busy}>
          刷新识别记录
        </Button>
      </div>
      {error && (
        <Alert type="error" showIcon message={error} className="spaced" />
      )}
      {!availability && !error ? (
        <Spin />
      ) : availability && !availability.configured ? (
        <Alert
          type="info"
          showIcon
          className="spaced"
          message="尚未启用订单识别，可直接手动填写右侧采购表单。"
        />
      ) : (
        <>
          {editable && (
            <Space wrap className="spaced">
              <Select
                aria-label="选择识别来源截图"
                placeholder="选择已绑定的订单截图"
                value={source}
                onChange={setSource}
                style={{ minWidth: 200 }}
                options={order.screenshots.map((image, index) => ({
                  value: image.id,
                  label: `订单截图 ${index + 1}`,
                }))}
              />
              <Button
                loading={busy}
                disabled={!source}
                onClick={() => void run()}
              >
                识别订单
              </Button>
            </Space>
          )}
          {!order.screenshots.length && (
            <Paragraph type="secondary">
              先上传并绑定订单截图，再开始识别。
            </Paragraph>
          )}
        </>
      )}
      {jobs.length > 0 && (
        <>
          <Select
            className="spaced"
            aria-label="查看识别任务"
            value={selected}
            onChange={setSelected}
            style={{ width: "100%" }}
            options={jobs.map((row, index) => ({
              value: row.jobId,
              label: `${index === 0 ? "最近任务" : "历史任务 " + (index + 1)} · ${statusNames[row.status]}`,
            }))}
          />
          {job && (
            <>
              <Space className="spaced">
                <Tag
                  color={
                    job.status === "SUCCEEDED"
                      ? "green"
                      : job.status === "FAILED"
                        ? "red"
                        : "blue"
                  }
                >
                  {statusNames[job.status]}
                </Tag>
                {["QUEUED", "RUNNING"].includes(job.status) && (
                  <Spin size="small" />
                )}
                {job.status === "FAILED" &&
                  editable &&
                  availability?.configured && (
                    <Button
                      size="small"
                      loading={busy}
                      onClick={() => void run(true)}
                    >
                      重新识别
                    </Button>
                  )}
              </Space>
              {job.errorCode && (
                <Paragraph type="secondary">
                  {job.status === "CANCELLED"
                    ? "采购状态或发起成员权限已变更。"
                    : "识别未完成，可重新尝试或继续手填。"}
                  （{job.errorCode}）
                </Paragraph>
              )}
              {job.result && (
                <>
                  <Alert
                    type="warning"
                    showIcon
                    className="spaced"
                    message="识别结果仅为候选。请对照原图核对，缺失字段继续手填；应用后仍需保存草稿并人工确认规格。"
                  />
                  <div className="ocr-values">
                    <Value
                      label="订单号"
                      field={job.result.candidates.orderNumber}
                    />
                    <Value
                      label="供应商"
                      field={job.result.candidates.supplier}
                    />
                    <Value
                      label="原图总额（元）"
                      field={job.result.candidates.sourceTotal}
                    />
                  </div>
                  {editable && (
                    <Button onClick={() => onMetadata(job.result!.candidates)}>
                      应用订单字段
                    </Button>
                  )}
                  {!job.result.candidates.items.length && (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="未找到明确标注的商品，可从识别原文核对并手填"
                    />
                  )}
                  {job.result.candidates.items.map((item, index) => (
                    <div className="ocr-candidate" key={index}>
                      <strong>候选商品 {index + 1}</strong>
                      <Value label="名称" field={item.name} />
                      <Value label="品牌" field={item.brand} />
                      <Value label="型号" field={item.model} />
                      <div className="form-two-columns">
                        <Value label="数量" field={item.quantity} />
                        <Value label="单价（元）" field={item.unitPrice} />
                      </div>
                      {editable && (
                        <Button onClick={() => onItem(job.jobId, index, item)}>
                          添加候选 {index + 1} 到采购明细
                        </Button>
                      )}
                    </div>
                  ))}
                  {job.result.warnings.includes("SOURCE_TOTAL_MISMATCH") && (
                    <Alert
                      type="warning"
                      showIcon
                      message="原图总额与识别明细不一致，请核对运费、折扣与商品数量。"
                    />
                  )}
                  <Collapse
                    className="spaced"
                    items={[
                      {
                        key: "text",
                        label: "查看识别原文与图片位置",
                        children: job.result.lines.map((line, index) => (
                          <div className="ocr-line" key={index}>
                            <Paragraph copyable>{line.text}</Paragraph>
                            <Text type="secondary">
                              {line.polygon.length
                                ? `原图坐标：${line.polygon.map((point) => `(${point.x}, ${point.y})`).join(" → ")}`
                                : "未提供原图坐标"}
                            </Text>
                          </div>
                        )),
                      },
                    ]}
                  />
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
