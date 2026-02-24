import { useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation } from "@tanstack/react-query";
import { useNotebookStore } from "../store/notebookStore";
import {
  createNotebookJupyter,
  toNotebookContent,
  updateNotebook,
} from "../services/jupyterClient";
import { CellItem } from "./CellItem";

type CellListProps = {
  notebookId: string;
};

export const CellList = ({ notebookId }: CellListProps) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const notebook = useNotebookStore((state) => state.notebooks[notebookId]);
  const cellOrder = notebook?.cellOrder ?? [];
  const addCell = useNotebookStore((state) => state.addCell);
  const moveCell = useNotebookStore((state) => state.moveCell);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const virtualizer = useVirtualizer({
    count: cellOrder.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 260,
    overscan: 6,
    getItemKey: (index) => cellOrder[index],
  });

  const items = virtualizer.getVirtualItems();

  const updateOrderMutation = useMutation({
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    moveCell(notebookId, String(active.id), String(over.id));
    updateOrderMutation.mutate();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-900 px-6 py-3">
        <p className="text-sm text-slate-400">
          Drag cells to reorder. Click run to execute.
        </p>
        <button
          onClick={() => addCell(notebookId)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          Add Cell
        </button>
      </div>
      <div ref={parentRef} className="flex-1 overflow-auto px-6 py-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={cellOrder} strategy={verticalListSortingStrategy}>
            <div  
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {items.map((virtualRow) => {
                const cellId = cellOrder[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 w-full"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div ref={virtualizer.measureElement} data-index={virtualRow.index}>
                      <CellItem
                        cellId={cellId}
                        notebookId={notebookId}
                        index={virtualRow.index}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
