import { useState } from "react";
import { useNotebookStore } from "../store/notebookStore";
import { createNotebookJupyter } from "../services/jupyterClient";

export const NotebookList = () => {
  const [name, setName] = useState("");
  const notebookOrder = useNotebookStore((state) => state.notebookOrder);
  const notebooks = useNotebookStore((state) => state.notebooks);
  const activeNotebookId = useNotebookStore((state) => state.activeNotebookId);
  const createNotebook = useNotebookStore((state) => state.createNotebook);
  const setActiveNotebook = useNotebookStore((state) => state.setActiveNotebook);

  const handleCreate = () => {
    createNotebook(name.trim() || undefined);
    createNotebookJupyter(name.trim());
    setName("");
  };

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">AryaXAI Workbench</h1>
        <p className="text-sm text-slate-400">Interactive Model Analysis</p>
      </div>
      <div className="mb-4 space-y-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New notebook name"
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <button
          onClick={handleCreate}
          className="w-full rounded bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Create Notebook
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
          Notebooks
        </p>
        <div className="space-y-2">
          {notebookOrder.map((id) => {
            const notebook = notebooks[id];
            const isActive = id === activeNotebookId;
            return (
              <div
                key={id}
                className={`flex items-center justify-between rounded border px-3 py-2 text-sm ${
                  isActive
                    ? "border-sky-500 bg-slate-800"
                    : "border-transparent bg-slate-900 hover:border-slate-700"
                }`}
              >
                <button
                  onClick={() => setActiveNotebook(id)}
                  className="flex-1 text-left"
                >
                  {notebook?.name.endsWith(".ipynb") ? notebook?.name : `${notebook?.name}.ipynb`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
