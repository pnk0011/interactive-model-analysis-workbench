import { create } from "zustand";
import { Cell, CellOutput, Notebook } from "../types";
import { createId } from "../utils/id";

type NotebookState = {
  notebooks: Record<string, Notebook>;
  notebookOrder: string[];
  cells: Record<string, Cell>;
  activeNotebookId?: string;
  isInitialized: boolean;
  initializeFromBackend: (notebooks: { name: string; path: string }[]) => void;
  setNotebookCells: (notebookId: string, codes: string[]) => void;
  createNotebook: (name?: string) => string;
  deleteNotebook: (id: string) => void;
  setActiveNotebook: (id: string) => void;
  addCell: (notebookId: string, afterId?: string) => string;
  deleteCell: (notebookId: string, cellId: string) => void;
  updateCellCode: (cellId: string, code: string) => void;
  moveCell: (notebookId: string, activeId: string, overId: string) => void;
  appendOutput: (cellId: string, output: CellOutput) => void;
  clearOutputs: (cellId: string) => void;
  setCellStatus: (cellId: string, status: Cell["status"]) => void;
  setNotebookKernel: (notebookId: string, kernelId: string) => void;
  setNotebookPath: (notebookId: string, path: string) => void;
};

const createStarterCell = (): Cell => ({
  id: createId(),
  code: "# Start exploring your model here\nprint('Hello, AryaXAI!')",
  outputs: [],
  status: "idle",
});

const createEmptyCell = (code = ""): Cell => ({
  id: createId(),
  code,
  outputs: [],
  status: "idle",
});

export const useNotebookStore = create<NotebookState>((set, get) => {
  return {
    notebooks: {},
    notebookOrder: [],
    cells: {},
    activeNotebookId: undefined,
    isInitialized: false,
    initializeFromBackend: (remoteNotebooks) => {
      if (get().isInitialized) {
        return;
      }
      if (remoteNotebooks.length === 0) {
        set({
          notebooks: {},
          notebookOrder: [],
          cells: {},
          activeNotebookId: undefined,
          isInitialized: true,
        });
        return;
      }
      const notebooks: Record<string, Notebook> = {};
      const cells: Record<string, Cell> = {};
      const notebookOrder: string[] = [];
      remoteNotebooks.forEach((remote) => {
        const notebookId = createId();
        const cell = createStarterCell();
        notebooks[notebookId] = {
          id: notebookId,
          name: remote.name,
          path: remote.path,
          hasLoaded: false,
          cellOrder: [cell.id],
        };
        cells[cell.id] = cell;
        notebookOrder.push(notebookId);
      });
      set({
        notebooks,
        cells,
        notebookOrder,
        activeNotebookId: notebookOrder[0],
        isInitialized: true,
      });
    },
    setNotebookCells: (notebookId, codes) => {
      set((state) => {
        const notebook = state.notebooks[notebookId];
        if (!notebook) {
          return state;
        }
        const nextCells = { ...state.cells };
        notebook.cellOrder.forEach((cellId) => {
          delete nextCells[cellId];
        });
        const normalizedCodes = codes.length === 0 ? [""] : codes;
        const cellOrder = normalizedCodes.map((code) => {
          const cell = createEmptyCell(code);
          nextCells[cell.id] = cell;
          return cell.id;
        });
        return {
          notebooks: {
            ...state.notebooks,
            [notebookId]: {
              ...notebook,
              cellOrder,
              hasLoaded: true,
            },
          },
          cells: nextCells,
        };
      });
    },
    createNotebook: (name) => {
      const id = createId();
      const cell = createStarterCell();
      console.log("createNotebook", cell);
      set((state) => ({
        notebooks: {
          ...state.notebooks,
          [id]: {
            id,
            name: name ?? "Untitled",
            cellOrder: [cell.id],
          },
        },
        notebookOrder: [...state.notebookOrder, id],
        cells: {
          ...state.cells,
          [cell.id]: cell,
        },
        activeNotebookId: id,
      }));
      return id;
    },
    deleteNotebook: (id) => {
      const state = get();
      const { [id]: removed, ...restNotebooks } = state.notebooks;
      const remainingOrder = state.notebookOrder.filter((item) => item !== id);
      const activeNotebookId =
        state.activeNotebookId === id ? remainingOrder[0] : state.activeNotebookId;
      if (removed) {
        const remainingCells = { ...state.cells };
        removed.cellOrder.forEach((cellId) => {
          delete remainingCells[cellId];
        });
        set({
          notebooks: restNotebooks,
          notebookOrder: remainingOrder,
          activeNotebookId,
          cells: remainingCells,
        });
      }
    },
    setActiveNotebook: (id) => set({ activeNotebookId: id }),
    addCell: (notebookId, afterId) => {
      const id = createId();
      set((state) => {
        const notebook = state.notebooks[notebookId];
        if (!notebook) {
          return state;
        }
        const newCell: Cell = {
          id,
          code: "",
          outputs: [],
          status: "idle",
        };
        const cellOrder = [...notebook.cellOrder];
        if (!afterId) {
          cellOrder.push(id);
        } else {
          const index = cellOrder.indexOf(afterId);
          cellOrder.splice(index + 1, 0, id);
        }
        return {
          notebooks: {
            ...state.notebooks,
            [notebookId]: {
              ...notebook,
              cellOrder,
            },
          },
          cells: {
            ...state.cells,
            [id]: newCell,
          },
        };
      });
      return id;
    },
    deleteCell: (notebookId, cellId) => {
      set((state) => {
        const notebook = state.notebooks[notebookId];
        if (!notebook) {
          return state;
        }
        const cellOrder = notebook.cellOrder.filter((id) => id !== cellId);
        const { [cellId]: removed, ...remainingCells } = state.cells;
        return {
          notebooks: {
            ...state.notebooks,
            [notebookId]: {
              ...notebook,
              cellOrder,
            },
          },
          cells: remainingCells,
        };
      });
    },
    updateCellCode: (cellId, code) =>
      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            code,
          },
        },
      })),
    moveCell: (notebookId, activeId, overId) => {
      set((state) => {
        const notebook = state.notebooks[notebookId];
        if (!notebook) {
          return state;
        }
        const cellOrder = [...notebook.cellOrder];
        const activeIndex = cellOrder.indexOf(activeId);
        const overIndex = cellOrder.indexOf(overId);
        if (activeIndex === -1 || overIndex === -1) {
          return state;
        }
        cellOrder.splice(activeIndex, 1);
        cellOrder.splice(overIndex, 0, activeId);
        return {
          notebooks: {
            ...state.notebooks,
            [notebookId]: {
              ...notebook,
              cellOrder,
            },
          },
        };
      });
    },
    appendOutput: (cellId, output) =>
      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells?.[cellId],
            outputs: [...state.cells?.[cellId]?.outputs, output],
          },
        },
      })),
    clearOutputs: (cellId) =>
      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            outputs: [],
          },
        },
      })),
    setCellStatus: (cellId, status) =>
      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            status,
          },
        },
      })),
    setNotebookKernel: (notebookId, kernelId) =>
      set((state) => ({
        notebooks: {
          ...state.notebooks,
          [notebookId]: {
            ...state.notebooks[notebookId],
            kernelId,
          },
        },
      })),
    setNotebookPath: (notebookId, path) =>
      set((state) => ({
        notebooks: {
          ...state.notebooks,
          [notebookId]: {
            ...state.notebooks[notebookId],
            path,
          },
        },
      })),
  };
});
