import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: 60000
});

export async function getStockList() {
  const { data } = await api.get("/stock/list");
  return data;
}

export async function getHistorical(params: { symbol: string; start?: string; end?: string; period?: string }) {
  const { data } = await api.get("/historical", { params });
  return data;
}

export async function postSync(body: Record<string, unknown>) {
  const { data } = await api.post("/sync/historical", body);
  return data;
}

export async function getSyncStatus(taskId: string) {
  const { data } = await api.get(`/sync/status/${taskId}`);
  return data;
}

export async function getMarketIndex() {
  const { data } = await api.get("/market/index");
  return data;
}
