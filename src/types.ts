export type CellOutput = {
  id: string;
  type: "stream" | "result" | "error" | "status";
  text: string;
};

export type Cell = {
  id: string;
  code: string;
  outputs: CellOutput[];
  status: "idle" | "running" | "error" | "success";
};

export type Notebook = {
  id: string;
  name: string;
  path?: string;
  kernelId?: string;
  cellOrder: string[];
  hasLoaded?: boolean;
};
