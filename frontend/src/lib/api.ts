export interface SavedDocument {
  id: number;
  documentType: string;
  fields: object;
  messages?: { role: "user" | "assistant"; content: string }[];
  updatedAt: string;
}

export type SaveBody = Pick<SavedDocument, "documentType" | "fields"> & Required<Pick<SavedDocument, "messages">>;

/** JSON request that throws the server's `detail` message on failure. */
async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().then((d) => d.detail).catch(() => null);
    throw new ApiError(response.status, typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const getMe = () => request<{ email: string }>("GET", "/api/auth/me");
export const signUp = (email: string, password: string) =>
  request<{ email: string }>("POST", "/api/auth/signup", { email, password });
export const signIn = (email: string, password: string) =>
  request<{ email: string }>("POST", "/api/auth/login", { email, password });
export const signOut = () => request<void>("POST", "/api/auth/logout");

export const listDocuments = () => request<SavedDocument[]>("GET", "/api/documents");
export const getDocument = (id: number) => request<SavedDocument>("GET", `/api/documents/${id}`);
export const createDocument = (body: SaveBody) => request<{ id: number }>("POST", "/api/documents", body);
export const updateDocument = (id: number, body: SaveBody) => request<{ id: number }>("PUT", `/api/documents/${id}`, body);
export const deleteDocument = (id: number) => request<void>("DELETE", `/api/documents/${id}`);
