import type { Pagination } from "@/lib/api/types";

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  meta: Record<string, unknown>;
  errors: Record<string, string[]> | null;
};

export function getPagination(meta: ApiEnvelope<unknown>["meta"]): Pagination | undefined {
  const pagination = meta.pagination;
  if (!pagination || typeof pagination !== "object") return undefined;
  const value = pagination as Record<string, unknown>;
  if (
    typeof value.current_page !== "number" ||
    typeof value.per_page !== "number" ||
    typeof value.total !== "number" ||
    typeof value.last_page !== "number" ||
    (value.from !== null && typeof value.from !== "number") ||
    (value.to !== null && typeof value.to !== "number")
  ) return undefined;
  return {
    current_page: value.current_page,
    per_page: value.per_page,
    total: value.total,
    last_page: value.last_page,
    from: value.from as number | null,
    to: value.to as number | null,
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly fieldErrors: Record<string, string[]> | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetchEnvelope<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`/api/proxy/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 204) {
    return { success: true, message: "", data: null, meta: {}, errors: null };
  }
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.success) {
    throw new ApiError(
      response.status,
      typeof envelope.meta.code === "string" ? envelope.meta.code : undefined,
      envelope.message,
      envelope.errors,
    );
  }
  return envelope;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const envelope = await apiFetchEnvelope<T>(path, init);
  return envelope.data as T;
}
