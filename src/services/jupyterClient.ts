const baseUrl =
  import.meta.env.VITE_JUPYTER_BASE_URL ??
  "http://localhost:8000/user/admin/api";
const token = import.meta.env.VITE_JUPYTER_TOKEN ?? "";

const withToken = (url: string) => {
  if (!token) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${token}`;
};

const headers = () => {
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    baseHeaders.Authorization = `token ${token}`;
  }
  return baseHeaders;
};

export type NotebookContent = {
  cells: {
    cell_type: "code";
    source: string[];
    metadata: Record<string, unknown>;
    outputs: unknown[];
    execution_count: number | null;
  }[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
};

type NotebookListItem = {
  type?: string;
  name?: string;
  path?: string;
};

export const listNotebooks = async () => {
  const response = await fetch(withToken(`${baseUrl}/contents`), {
    method: "GET",
    headers: headers(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch notebooks");
  }
  const data = (await response.json()) as {
    content?: NotebookListItem[];
  };
  const content = Array.isArray(data.content) ? data.content : [];
  return content
    .filter((item) => item.type === "notebook")
    .map((item) => ({
      name: item.name ?? "Untitled.ipynb",
      path: item.path ?? "Untitled.ipynb",
    }));
};

export const fetchNotebookContent = async (path: string) => {
  const response = await fetch(
    withToken(`${baseUrl}/contents/${path}?content=1`),
    {
      method: "GET",
      headers: headers(),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch notebook content");
  }
  const data = (await response.json()) as { content?: NotebookContent };
  const content = data.content;
  if (!content || !Array.isArray(content.cells)) {
    return [] as string[];
  }
  return content.cells
    .filter((cell) => cell.cell_type === "code")
    .map((cell) => {
      if (Array.isArray(cell.source)) {
        return cell.source.join("");
      }
      return typeof cell.source === "string" ? cell.source : "";
    });
};

export const createNotebookJupyter = async (name: string) => {
  const safeName = name.endsWith(".ipynb") ? name : `${name}.ipynb`;
  const response = await fetch(
    withToken(`${baseUrl}/contents/${safeName}`),
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        type: "notebook",
        format: "json",
        content: {
          cells: [],
          metadata: {},
          nbformat: 4,
          nbformat_minor: 5,
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to create notebook");
  }

  const data = (await response.json()) as { path: string };
  return data.path;
};

export const updateNotebook = async (path: string, notebook: NotebookContent) => {
  const response = await fetch(
    withToken(`${baseUrl}/contents/${path}`),
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        type: "notebook",
        format: "json",
        content: notebook,
      }),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to update notebook");
  }
  return response.json();
};

export const createKernel = async () => {
  const response = await fetch(withToken(`${baseUrl}/kernels`), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name: "python3" }),
  });
  if (!response.ok) {
    throw new Error("Failed to create kernel");
  }
  const data = (await response.json()) as { id: string };
  return data.id;
};

export const toNotebookContent = (codes: string[]) => ({
  cells: codes.map((code) => ({
    cell_type: "code" as const,
    source: code.split("\n").map((line) => `${line}\n`),
    metadata: {},
    outputs: [],
    execution_count: null,
  })),
  metadata: {},
  nbformat: 4,
  nbformat_minor: 5,
});
