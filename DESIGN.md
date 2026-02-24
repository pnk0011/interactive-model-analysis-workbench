## Overview

## Zustand Store Structure

The store is normalized to avoid deep nesting and to keep updates focused:

- `notebooks`: dictionary keyed by notebook id. Each entry stores metadata (`name`,
  optional `path`, optional `kernelId`) and `cellOrder`.
- `cells`: dictionary keyed by cell id with `code`, `outputs`, and `status`.
- `activeNotebookId`: currently selected notebook.
- `isInitialized`: guards the first backend sync to avoid reinitialization.

Actions are designed around common notebook operations (create/delete notebook, add/delete
cell, reorder cells, set outputs, update code). This keeps per-cell updates isolated and
prevents re-rendering unrelated components.

## WebSocket Strategy

WebSocket connections are managed centrally in `websocketManager.ts`:

- A single socket is created per kernel id and reused for subsequent executions.
- Each execution generates a unique `msg_id`, and incoming messages are filtered by
  `parent_header.msg_id` so outputs are delivered to the correct cell.
- A stable session id is created per socket to satisfy Jupyter message semantics.
- Listeners are reference-counted; sockets close automatically when no listeners remain.
- If the socket is not yet open, outbound execute requests are queued and flushed on open.

This approach avoids unnecessary socket churn and prevents output leakage across cells.

## Component Breakdown Rationale

The UI is divided by responsibilities to isolate state changes and improve performance:

- `NotebookList`: creation and selection of notebooks; isolated from cell rendering.
- `NotebookWorkspace`: orchestrates active notebook selection and backend content loading.
- `CellList`: virtualized list + drag-and-drop container for large notebooks.
- `CellItem`: focused cell editor and output view; runs execution and updates cell state.

This separation keeps re-renders localized (e.g., streaming output for one cell does not
re-render the sidebar), and allows the list to stay performant with many cells.

## Performance Considerations

The cell list uses `@tanstack/react-virtual` to render only visible cells. This keeps the
UI responsive even with hundreds of cells and avoids costly full list re-renders.
