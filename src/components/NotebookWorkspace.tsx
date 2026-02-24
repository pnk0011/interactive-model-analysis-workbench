import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNotebookStore } from "../store/notebookStore";
import { CellList } from "./CellList";
import { createNotebookJupyter, fetchNotebookContent } from "../services/jupyterClient";

export const NotebookWorkspace = () => {
  const activeNotebookId = useNotebookStore((state) => state.activeNotebookId);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const setNotebookPath = useNotebookStore((state) => state.setNotebookPath);
  const setNotebookCells = useNotebookStore((state) => state.setNotebookCells);

  const activeNotebook = useMemo(
    () => (activeNotebookId ? notebooks[activeNotebookId] : undefined),
    [activeNotebookId, notebooks]
  );

  const notebookContentQuery = useQuery({
    queryKey: ["notebookContent", activeNotebook?.path],
    queryFn: () => fetchNotebookContent(activeNotebook!.path!),
    enabled: Boolean(activeNotebook?.path),
  });

  useEffect(() => {
    if (!activeNotebook?.path) {
      return;
    }
    if (notebookContentQuery.isSuccess) {
      setNotebookCells(activeNotebook.id, notebookContentQuery.data ?? []);
    }
  }, [
    activeNotebook?.id,
    activeNotebook?.path,
    notebookContentQuery.data,
    notebookContentQuery.isSuccess,
    setNotebookCells,
  ]);

  const handleSyncNotebook = async () => {
    if (!activeNotebook) {
      return;
    }
    if (activeNotebook.path) {
      return;
    }
    const path = await createNotebookJupyter(activeNotebook.name);
    setNotebookPath(activeNotebook.id, path);
  };

  if (!activeNotebook) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Create or select a notebook to get started.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{activeNotebook.name}</h2>
          <p className="text-sm text-slate-400">
            Cells: {activeNotebook.cellOrder.length}
          </p>
        </div>
        <div>
           Active kaernal {activeNotebook.kernelId}
        </div>
        <button
          onClick={handleSyncNotebook}
          className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-sky-500 hover:text-sky-200"
        >
          Sync to Jupyter
        </button>
      </div>
      {notebookContentQuery.isLoading && activeNotebook.path ? (
        <div className="flex flex-1 items-center justify-center text-slate-400">
          Loading notebook content...
        </div>
      ) : (
        <CellList notebookId={activeNotebook.id} />
      )}
    </div>
  );
};
