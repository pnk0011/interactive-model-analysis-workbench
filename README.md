# Interactive Model Analysis Workbench

High-fidelity prototype of an interactive notebook workbench with realtime execution,
virtualized cell rendering, and drag-and-drop cell ordering.

## Prerequisites

- Node.js 18+
- JupyterHub backend running locally

## Install Dependencies

```bash
cd /AryaAi
npm install
```

## Configure Environment

Create a `.env` file in the project root:

```
VITE_JUPYTER_BASE_URL=http://localhost:8000/user/admin/api
VITE_JUPYTER_TOKEN=your-token-here
```

## Run the App

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build (Optional)

```bash
npm run build
```
