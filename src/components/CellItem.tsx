import { useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNotebookStore } from "../store/notebookStore";
import {
  createKernel,
  createNotebookJupyter,
  toNotebookContent,
  updateNotebook
  ,
} from "../services/jupyterClient";
import { runCode } from "../services/websocketManager";
import { createId } from "../utils/id";

type CellItemProps = {
  cellId: string;
  notebookId: string;
  index: number;
};

export const CellItem = ({ cellId, notebookId, index }: CellItemProps) => {
  const cell = useNotebookStore((state) => state.cells[cellId]);
  const notebook = useNotebookStore((state) => state.notebooks[notebookId]);
  const updateCellCode = useNotebookStore((state) => state.updateCellCode);
  const deleteCell = useNotebookStore((state) => state.deleteCell);
  const addCell = useNotebookStore((state) => state.addCell);
  const clearOutputs = useNotebookStore((state) => state.clearOutputs);
  const appendOutput = useNotebookStore((state) => state.appendOutput);
  const setCellStatus = useNotebookStore((state) => state.setCellStatus);
  const setNotebookKernel = useNotebookStore((state) => state.setNotebookKernel);
  const stopRef = useRef<null | (() => void)>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cellId });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
    }),
    [transform, transition]
  );

  const updateMutation = useMutation({
    mutationFn: async () => {
      const state = useNotebookStore.getState();
      const activeNotebook = state.notebooks[notebookId];
      if (!activeNotebook) {
        throw new Error("Notebook not found");
      }
      let path = activeNotebook.path;
      if (!path) {
        path = await createNotebookJupyter(activeNotebook.name);
        state.setNotebookPath(notebookId, path);
      }
      const codes = activeNotebook.cellOrder.map(
        (id) => state.cells[id]?.code ?? ""
      );
      return updateNotebook(path, toNotebookContent(codes));
    },
  });

  const handleRun = async () => {
    if (!cell || !notebook) {
      return;
    }
    stopRef.current?.();
    clearOutputs(cellId);
    setCellStatus(cellId, "running");
    appendOutput(cellId, {
      id: createId(),
      type: "status",
      text: "Syncing notebook to Jupyter...",
    });
    
    try {
      await updateMutation.mutateAsync();
    } catch (error) {
      setCellStatus(cellId, "error");
      appendOutput(cellId, {
        id: createId(),
        type: "error",
        text: (error as Error).message,
      });
      return;
    }
    let kernelId = notebook.kernelId;
    if (!kernelId) {
      appendOutput(cellId, {
        id: createId(),
        type: "status",
        text: "Starting Jupyter kernel...",
      });
      try {
        kernelId = await createKernel();
        setNotebookKernel(notebookId, kernelId);
      } catch (error) {
        setCellStatus(cellId, "error");
        appendOutput(cellId, {
          id: createId(),
          type: "error",
          text: (error as Error).message,
        });
        return;
      }
    }
    console.log("error here" , cellId , cell , "undefined");
    appendOutput(cellId, {
      id: createId(),
      type: "status",
      text: "Executing cell via websocket...",
    });
    stopRef.current = runCode(kernelId, cell.code, (output) => {
      appendOutput(cellId, output);
      if (output.type === "error") {
        setCellStatus(cellId, "error");
        stopRef.current?.();
        stopRef.current = null;
      }
      if (output.type === "status" && output.text.includes("idle")) {
        setCellStatus(cellId, "success");
        stopRef.current?.();
        stopRef.current = null;
      }
    });
  };

  if (!cell) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4 shadow-sm ${
        isDragging ? "opacity-70" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
            In [{index + 1}]
          </span>
          <span className="text-xs text-slate-400">{cell.status}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
          >
            Drag
          </button>
          <button
            onClick={handleRun}
            className="rounded bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Run
          </button>
          <button
            onClick={() => addCell(notebookId, cellId)}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
          >
            Add Below
          </button>
          <button
            onClick={() => deleteCell(notebookId, cellId)}
            className="rounded border border-rose-500/60 px-2 py-1 text-xs text-rose-300 hover:border-rose-400"
          >
            Delete
          </button>
        </div>
      </div>
      <textarea
        value={cell.code}
        onChange={(event) => updateCellCode(cellId, event.target.value)}
        placeholder="Write Python code..."
        className="min-h-[120px] w-full rounded border border-slate-800 bg-slate-950/80 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-500"
      />
      <div className="mt-3 space-y-2 rounded border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-200">
        {cell.outputs.length === 0 ? (
          <p className="text-slate-500">Output will appear here.</p>
        ) : (
          cell.outputs.map((output) => (
            <pre
              key={output.id}
              className={`whitespace-pre-wrap rounded px-2 py-1 text-xs ${
                output.type === "error" ? "text-rose-300" : "text-slate-100"
              }`}
            >
              {output.text}
            </pre>
          ))
        )}
      </div>
    </div>
  );
};
