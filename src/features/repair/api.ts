export type Role = "HQ_ADMIN" | "STORE_MANAGER" | "ENGINEER";
export type Store = {
  id: string;
  code: string;
  name: string;
  region: string;
  address: string;
  status: "ACTIVE" | "DISABLED";
  version: number;
};
export type Member = {
  id: string;
  email: string;
  displayName: string;
  contactPhone: string;
  role: Role;
  status: string;
  version: number;
  stores: Store[];
};
export type Session = {
  id: string;
  displayName: string;
  email: string;
  contactPhone: string;
  role: Role;
  memberVersion: number;
  allowedStores: Store[];
  repairProfileComplete: boolean;
  permissions: string[];
};
export type Page<T> = { items: T[]; page: number; size: number; total: number };
type Tokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};
export type LoginResult = {
  user: { id: string; email: string; displayName: string };
  token: Tokens;
};
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");
const key = "repair_auth_tokens";
export const roleNames: Record<Role, string> = {
  HQ_ADMIN: "总部管理员",
  STORE_MANAGER: "门店管理员",
  ENGINEER: "维修工程师",
};
export function tokens(): Tokens | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
export function saveTokens(value: Tokens | null) {
  if (value) localStorage.setItem(key, JSON.stringify(value));
  else localStorage.removeItem(key);
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
  }
}
const pendingKeys = new Map<string, string>();
let refreshing: Promise<void> | null = null;
export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    anonymous?: boolean;
    invitation?: string;
    retry?: boolean;
    idempotencyKey?: string;
    responseType?: "blob";
  } = {},
): Promise<T> {
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const multipart = options.body instanceof FormData;
  if (multipart) delete headers["Content-Type"];
  if (!options.anonymous && tokens())
    headers.Authorization = "Bearer " + tokens()!.accessToken;
  if (options.invitation) headers["X-Repair-Invitation"] = options.invitation;
  const signature =
    method + path + (options.idempotencyKey || JSON.stringify(options.body));
  if (
    path.startsWith("/repair/") &&
    !path.startsWith("/repair/invitations/accept") &&
    !path.startsWith("/repair/invitations/preview") &&
    method !== "GET"
  ) {
    if (!pendingKeys.has(signature))
      pendingKeys.set(signature, options.idempotencyKey || crypto.randomUUID());
    headers["Idempotency-Key"] = pendingKeys.get(signature)!;
  }
  let response: Response;
  try {
    response = await fetch(apiBaseUrl + path, {
      method,
      headers,
      body:
        options.body === undefined
          ? undefined
          : multipart
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  } catch {
    throw new Error("网络连接失败，请检查连接后重试；已填写的内容会保留。");
  }
  if (
    response.status === 401 &&
    !options.anonymous &&
    !options.retry &&
    tokens()
  ) {
    if (!refreshing)
      refreshing = api<Tokens>("/auth/token/refresh", {
        method: "POST",
        body: { refreshToken: tokens()!.refreshToken },
        anonymous: true,
      })
        .then(saveTokens)
        .catch((error) => {
          saveTokens(null);
          window.dispatchEvent(new Event("repair-auth-expired"));
          throw error;
        })
        .finally(() => {
          refreshing = null;
        });
    await refreshing;
    return api<T>(path, { ...options, retry: true });
  }
  let data;
  if (response.ok && options.responseType === "blob")
    return (await response.blob()) as T;
  try {
    data = response.status === 204 ? null : await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "服务响应异常，请稍后重试。",
    );
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.code || "REQUEST_FAILED",
      data?.message || "请求失败，请重试",
      data?.requestId,
    );
  pendingKeys.delete(signature);
  return data as T;
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试";
}
