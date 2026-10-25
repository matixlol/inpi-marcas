import type { Marca, SearchResponse, Titular } from "./types.ts";

const INPI_URL = "https://portaltramites.inpi.gob.ar/MarcasConsultas/GrillaMarcasAvanzada";
const MAX_ROWS = 1000;

type InpiRow = {
  Acta: number;
  Titulares: string | null;
  Fecha_Ingreso: string | null;
  Clase: number;
  Denominacion: string | null;
  Tipo_Marca: string | null;
  Numero_Resolucion: string | null;
  Estado: string | null;
  Fecha_Vencimiento: string | null;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors, ...extra },
  });

// INPI serializes dates as "/Date(ms)/"; negative values mean "no date".
const parseDate = (value: string | null): string | null => {
  const ms = Number(value?.match(/-?\d+/)?.[0]);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString().slice(0, 10) : null;
};

// "20241591205  PEREZ, JUAN 50.00% - 27334203919  GOMEZ, ANA 50.00%"
const parseTitulares = (value: string | null): Titular[] =>
  (value ?? "")
    .split(/\s+-\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(?:(\d{11}) )?(.*?)(?: (\d+(?:\.\d+)?)%)?$/)!;
      return { cuit: m[1] ?? null, nombre: m[2], porcentaje: m[3] ? Number(m[3]) : null };
    });

const toMarca = (row: InpiRow): Marca => ({
  acta: row.Acta,
  denominacion: (row.Denominacion ?? "").replace(/\s+/g, " ").trim(),
  clase: row.Clase,
  tipo: row.Tipo_Marca,
  estado: row.Estado,
  resolucion: row.Numero_Resolucion || null,
  ingreso: parseDate(row.Fecha_Ingreso),
  vencimiento: parseDate(row.Fecha_Vencimiento),
  titulares: parseTitulares(row.Titulares),
});

async function search(params: URLSearchParams): Promise<Response> {
  const q = params.get("q")?.trim() ?? "";
  const titular = params.get("titular")?.trim() ?? "";
  if (q.length < 2 && titular.length < 2) {
    return json({ error: "Escribí al menos 2 letras." }, 400);
  }

  const body = new URLSearchParams({
    Tipo_Resolucion: params.get("estado") ?? "",
    Clase: params.get("clase") || "-1",
    // 0 = empieza con, 1 = contiene
    TipoBusquedaDenominacion: params.get("modo") === "empieza" ? "0" : "1",
    Denominacion: q,
    Titular: titular,
    TipoBusquedaTitular: params.get("modoTitular") === "empieza" ? "0" : "1",
    Fecha_IngresoDesde: "",
    Fecha_IngresoHasta: "",
    Fecha_ResolucionDesde: "",
    Fecha_ResolucionHasta: "",
    vigentes: params.get("vigentes") === "1" ? "true" : "false",
    limit: String(MAX_ROWS),
    offset: "0",
  });

  const res = await fetch(INPI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });
  if (!res.ok) {
    return json({ error: `El INPI respondió ${res.status}.` }, 502);
  }
  const data = (await res.json()) as { total: number; rows: InpiRow[] };
  const result: SearchResponse = {
    total: data.total,
    truncated: data.total > data.rows.length,
    marcas: data.rows.map(toMarca),
  };
  return json(result, 200, { "Cache-Control": "public, max-age=600" });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === "/api/buscar") {
      try {
        return await search(url.searchParams);
      } catch (error) {
        return json({ error: `No se pudo consultar el INPI: ${String(error)}` }, 502);
      }
    }
    return json({ error: "Not found" }, 404);
  },
};
