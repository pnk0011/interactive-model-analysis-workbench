import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotebookList } from "./components/NotebookList";
import { NotebookWorkspace } from "./components/NotebookWorkspace";
import { listNotebooks } from "./services/jupyterClient";
import { useNotebookStore } from "./store/notebookStore";

const App = () => {
  const initializeFromBackend = useNotebookStore(
    (state) => state.initializeFromBackend
  );
  const isInitialized = useNotebookStore((state) => state.isInitialized);
  const { data, isSuccess, isError } = useQuery({
    queryKey: ["notebooks"],
    queryFn: listNotebooks,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (isInitialized) {
      return;
    }
    if (isSuccess) {
      initializeFromBackend(data ?? []);
    } else if (isError) {
      initializeFromBackend([]);
    }
  }, [data, initializeFromBackend, isError, isInitialized, isSuccess]);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100">
      <aside className="w-72 border-r border-slate-800 bg-slate-900/60">
        <NotebookList />
      </aside>
      <main className="flex-1">
        <NotebookWorkspace />
      </main>
    </div>
  );
};

export default App;
