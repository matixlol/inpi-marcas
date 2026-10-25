import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CLASES,
  ESTADOS_INPI,
  PRODUCTOS_HASTA,
  SITUACIONES,
  TIPOS,
  claseNombre,
  situacion,
  type Situacion,
} from "./data.ts";
import type { Marca, SearchResponse } from "./types.ts";

const API_URL = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_URL ?? "");

type Params = { q: string; modo: string; clase: string; estado: string; titular: string };

const readParams = (): Params => {
  const s = new URLSearchParams(location.search);
  return {
    q: s.get("q") ?? "",
    modo: s.get("modo") ?? "contiene",
    clase: s.get("clase") ?? "",
    estado: s.get("estado") ?? "",
    titular: s.get("titular") ?? "",
  };
};

async function buscar(p: Params): Promise<SearchResponse> {
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v));
  const res = await fetch(`${API_URL}/api/buscar?${qs}`);
  const body = (await res.json()) as SearchResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `El servidor respondió ${res.status}.`);
  return body;
}

const fmtFecha = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR") : "sin fecha";

function tiempoHasta(iso: string): string {
  const years = (new Date(iso).getTime() - Date.now()) / (365.25 * 864e5);
  const n = Math.round(Math.abs(years));
  const txt = Math.abs(years) >= 1 ? `${n} año${n === 1 ? "" : "s"}` : `${Math.max(1, Math.round(Math.abs(years) * 12))} meses`;
  return years >= 0 ? `en ${txt}` : `hace ${txt}`;
}

// Accent- and case-insensitive; one output char per input char so indices
// line up with the original text.
const normalize = (s: string) =>
  [...s].map((c) => (c.normalize("NFD").replace(/[\u0300-\u036f]/g, "") || c)[0].toUpperCase()).join("");

function Highlight({ text, term }: { text: string; term: string }) {
  const i = term ? normalize(text).indexOf(normalize(term)) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

const lista = (xs: (string | number)[]) =>
  xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;

/** How a class tile looks: the strongest situation among its marks. */
type Ocupacion = "vigente" | "tramite" | "antecedente" | "libre";

export function App() {
  const [params, setParams] = useState<Params>(readParams);
  const [draft, setDraft] = useState<Params>(params);
  const [filtroSituacion, setFiltroSituacion] = useState<Situacion | null>(null);
  const [filtroClase, setFiltroClase] = useState<number | null>(null);
  const [orden, setOrden] = useState<"recientes" | "nombre" | "clase">("recientes");

  useEffect(() => {
    const onPop = () => {
      const p = readParams();
      setParams(p);
      setDraft(p);
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);

  const enabled = params.q.trim().length >= 2 || params.titular.trim().length >= 2;
  const query = useQuery({
    queryKey: ["buscar", params],
    queryFn: () => buscar(params),
    enabled,
    staleTime: 10 * 60_000,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = { ...draft, q: draft.q.trim(), titular: draft.titular.trim() };
    setParams(next);
    setFiltroSituacion(null);
    setFiltroClase(null);
    const qs = new URLSearchParams(Object.entries(next).filter(([k, v]) => v && !(k === "modo" && v === "contiene")));
    history.pushState(null, "", `?${qs}`);
  };

  const marcas = query.data?.marcas ?? [];
  const conSituacion = useMemo(() => marcas.map((m) => ({ m, s: situacion(m) })), [marcas]);

  const porSituacion = useMemo(() => {
    const counts = new Map<Situacion, number>();
    for (const { m, s } of conSituacion)
      if (filtroClase === null || m.clase === filtroClase) counts.set(s, (counts.get(s) ?? 0) + 1);
    return counts;
  }, [conSituacion, filtroClase]);

  const ocupacion = useMemo(() => {
    const map = new Map<number, { estado: Ocupacion; total: number }>();
    const rank: Record<Ocupacion, number> = { libre: 0, antecedente: 1, tramite: 2, vigente: 3 };
    for (const { m, s } of conSituacion) {
      const o: Ocupacion = s === "vigente" ? "vigente" : s === "tramite" ? "tramite" : "antecedente";
      const prev = map.get(m.clase) ?? { estado: "libre" as Ocupacion, total: 0 };
      map.set(m.clase, { estado: rank[o] > rank[prev.estado] ? o : prev.estado, total: prev.total + 1 });
    }
    return map;
  }, [conSituacion]);

  const visibles = useMemo(() => {
    const list = conSituacion.filter(
      ({ m, s }) =>
        (filtroClase === null || m.clase === filtroClase) && (filtroSituacion === null || s === filtroSituacion),
    );
    const cmp: Record<typeof orden, (a: Marca, b: Marca) => number> = {
      recientes: (a, b) => b.acta - a.acta,
      nombre: (a, b) => a.denominacion.localeCompare(b.denominacion),
      clase: (a, b) => a.clase - b.clase || b.acta - a.acta,
    };
    return list.sort((a, b) => cmp[orden](a.m, b.m));
  }, [conSituacion, filtroClase, filtroSituacion, orden]);

  const clasesCon = (o: Ocupacion) =>
    [...ocupacion.entries()].filter(([, v]) => v.estado === o).map(([c]) => c).sort((a, b) => a - b);
  const exactas = conSituacion.filter(
    ({ m, s }) => SITUACIONES[s].bloquea && params.q && normalize(m.denominacion) === normalize(params.q),
  );
  const buscado = params.q || params.titular;

  return (
    <div className="page">
      <header className="masthead">
        <a className="wordmark" href="/">
          Marcas a la vista
        </a>
        <span className="source">con datos del INPI, en vivo</span>
      </header>

      <form className="search" onSubmit={submit} role="search">
        <label className="sr-only" htmlFor="q">
          Nombre de la marca
        </label>
        <div className="search-line">
          <input
            id="q"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="Escribí un nombre"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          />
          <button type="submit">Buscar</button>
        </div>
        <div className="filters">
          <label>
            <span>Coincidencia</span>
            <select value={draft.modo} onChange={(e) => setDraft({ ...draft, modo: e.target.value })}>
              <option value="contiene">Contiene el texto</option>
              <option value="empieza">Empieza con</option>
            </select>
          </label>
          <label>
            <span>Clase</span>
            <select value={draft.clase} onChange={(e) => setDraft({ ...draft, clase: e.target.value })}>
              <option value="">Todas</option>
              {Object.entries(CLASES)
                .filter(([n]) => n !== "0")
                .map(([n, name]) => (
                  <option key={n} value={n}>
                    {n}. {name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Estado</span>
            <select value={draft.estado} onChange={(e) => setDraft({ ...draft, estado: e.target.value })}>
              {ESTADOS_INPI.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.value ? e.label : "Todos"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Titular</span>
            <input
              placeholder="Nombre o CUIT"
              value={draft.titular}
              onChange={(e) => setDraft({ ...draft, titular: e.target.value })}
            />
          </label>
        </div>
      </form>

      {!enabled && (
        <section className="intro">
          <p className="lede">
            Buscá un nombre y mirá en cuáles de los 45 rubros del INPI ya tiene dueño. Una marca protege solo el
            rubro (la clase) donde se registró.
          </p>
          <NizaMapa ocupacion={new Map()} activa={null} onPick={() => {}} vacio />
          <Glosario abierto />
        </section>
      )}

      {enabled && query.isPending && <p className="status">Consultando al INPI…</p>}
      {query.isError && (
        <p className="status error">
          No pudimos consultar al INPI. {query.error.message} Probá de nuevo en un momento.
        </p>
      )}

      {query.data && (
        <>
          <section className="verdict" aria-live="polite">
            <h1 className="sr-only">Resultados para {buscado}</h1>
            <p className="verdict-text">
              <Veredicto
                total={query.data.total}
                vigentes={clasesCon("vigente")}
                tramite={clasesCon("tramite")}
                modo={params.modo}
              />
            </p>
            {exactas.length > 0 && (
              <p className="exact">
                El nombre exacto ya tiene dueño en {exactas.length === 1 ? "la clase" : "las clases"}{" "}
                {lista([...new Set(exactas.map(({ m }) => m.clase))].sort((a, b) => a - b))}. Si tu rubro es
                alguno de esos, vas a necesitar otro nombre o el permiso del titular.
              </p>
            )}
            {query.data.truncated && (
              <p className="note">
                Mostramos los primeros {marcas.length} de {query.data.total}. Elegí una clase para ver el resto.
              </p>
            )}
          </section>

          <NizaMapa
            ocupacion={ocupacion}
            activa={filtroClase}
            onPick={(c) => setFiltroClase(filtroClase === c ? null : c)}
          />

          <section className="results">
            <div className="results-head">
              <h2>
                {filtroClase !== null ? `Clase ${filtroClase}: ${claseNombre(filtroClase)}` : "Todas las marcas"}
              </h2>
              <div className="results-tools">
                <div className="seg" role="group" aria-label="Filtrar por estado">
                  <button className={filtroSituacion === null ? "on" : ""} onClick={() => setFiltroSituacion(null)}>
                    Todas <span>{[...porSituacion.values()].reduce((a, b) => a + b, 0)}</span>
                  </button>
                  {(Object.keys(SITUACIONES) as Situacion[])
                    .filter((s) => porSituacion.get(s))
                    .map((s) => (
                      <button
                        key={s}
                        className={filtroSituacion === s ? "on" : ""}
                        onClick={() => setFiltroSituacion(filtroSituacion === s ? null : s)}
                        title={SITUACIONES[s].explicacion}
                      >
                        <i className={`dot s-${s}`} aria-hidden />
                        {SITUACIONES[s].label} <span>{porSituacion.get(s)}</span>
                      </button>
                    ))}
                </div>
                <label className="sort">
                  Ordenar por
                  <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
                    <option value="recientes">más recientes</option>
                    <option value="nombre">nombre</option>
                    <option value="clase">clase</option>
                  </select>
                </label>
              </div>
            </div>

            {visibles.length === 0 ? (
              <p className="status">
                Ninguna marca coincide con estos filtros.{" "}
                <button
                  className="link"
                  onClick={() => {
                    setFiltroClase(null);
                    setFiltroSituacion(null);
                  }}
                >
                  Ver todas
                </button>
              </p>
            ) : (
              <ol className="rows">
                {visibles.map(({ m, s }) => (
                  <Fila key={m.acta} marca={m} situacion={s} term={params.q} />
                ))}
              </ol>
            )}
          </section>

          <Glosario />
        </>
      )}

      <footer>
        Los datos salen del{" "}
        <a href="https://portaltramites.inpi.gob.ar/marcasconsultas/busqueda" target="_blank" rel="noreferrer">
          buscador oficial del INPI
        </a>
        . Esta búsqueda compara cómo se escriben las marcas, no cómo suenan, y no reemplaza el consejo de un agente
        de la propiedad industrial.
      </footer>
    </div>
  );
}

function Veredicto({
  total,
  vigentes,
  tramite,
  modo,
}: {
  total: number;
  vigentes: number[];
  tramite: number[];
  modo: string;
}) {
  const encontradas = `${total} marca${total === 1 ? "" : "s"} ${modo === "empieza" ? "empiezan con" : "contienen"} este texto.`;
  if (total === 0) return <>Ninguna marca registrada o pedida contiene este texto. Igual conviene probar variantes y cómo suena.</>;
  if (vigentes.length === 0 && tramite.length === 0)
    return <>{encontradas} Ninguna está vigente ni en trámite, así que hoy no bloquean a nadie.</>;
  return (
    <>
      {encontradas}{" "}
      {vigentes.length > 0 && (
        <>
          Hay registros vigentes en {vigentes.length === 1 ? "la clase" : "las clases"} {lista(vigentes)}.{" "}
        </>
      )}
      {tramite.length > 0 && (
        <>
          Hay pedidos en trámite en {tramite.length === 1 ? "la clase" : "las clases"} {lista(tramite)}.
        </>
      )}
    </>
  );
}

function NizaMapa({
  ocupacion,
  activa,
  onPick,
  vacio = false,
}: {
  ocupacion: Map<number, { estado: Ocupacion; total: number }>;
  activa: number | null;
  onPick: (clase: number) => void;
  vacio?: boolean;
}) {
  const grupo = (titulo: string, desde: number, hasta: number) => (
    <div className="niza-group">
      <h3>{titulo}</h3>
      <div className="niza-tiles">
        {Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i).map((c) => {
          const o = ocupacion.get(c);
          const estado = o?.estado ?? "libre";
          const label = `Clase ${c}, ${CLASES[c]}${o ? `: ${o.total} marca${o.total === 1 ? "" : "s"}` : ""}`;
          return (
            <button
              key={c}
              className={`tile o-${estado} ${activa === c ? "active" : ""}`}
              onClick={() => onPick(c)}
              disabled={vacio || !o}
              title={label}
              aria-label={label}
              aria-pressed={activa === c}
            >
              <span className="tile-num">{c}</span>
              <span className="tile-name">{CLASES[c]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <section className={`niza ${vacio ? "is-empty" : ""}`} aria-label="Mapa de las 45 clases">
      {grupo("Productos", 1, PRODUCTOS_HASTA)}
      {grupo("Servicios", PRODUCTOS_HASTA + 1, 45)}
      {!vacio && (
        <ul className="niza-legend">
          <li>
            <i className="sw o-vigente" /> Vigente: tiene dueño
          </li>
          <li>
            <i className="sw o-tramite" /> En trámite: alguien la pidió
          </li>
          <li>
            <i className="sw o-antecedente" /> Solo antecedentes vencidos o rechazados
          </li>
          <li>
            <i className="sw o-libre" /> Sin coincidencias
          </li>
        </ul>
      )}
    </section>
  );
}

function Fila({ marca: m, situacion: s, term }: { marca: Marca; situacion: Situacion; term: string }) {
  const info = SITUACIONES[s];
  const titular = m.titulares[0]?.nombre ?? "Sin titular informado";
  const otros = m.titulares.length - 1;
  return (
    <li className={`row s-${s}`}>
      <details>
        <summary>
          <span className="row-name">
            <Highlight text={m.denominacion || "(sin nombre)"} term={term} />
          </span>
          <span className="row-clase" title={claseNombre(m.clase)}>
            <b>{m.clase}</b> {claseNombre(m.clase)}
          </span>
          <span className="row-estado">
            <i className={`dot s-${s}`} aria-hidden />
            {info.label}
          </span>
          <span className="row-titular">
            {titular}
            {otros > 0 && <small> y {otros} más</small>}
          </span>
          <span className="row-fecha">
            {m.vencimiento ? (
              <>
                {s === "vigente" ? "Vence" : "Venció"} {fmtFecha(m.vencimiento)}
              </>
            ) : (
              <>Pedida {fmtFecha(m.ingreso)}</>
            )}
          </span>
        </summary>
        <div className="row-detail">
          <p className="row-explain">{info.explicacion}</p>
          <dl>
            <div>
              <dt>{m.titulares.length > 1 ? "Titulares" : "Titular"}</dt>
              <dd>
                {m.titulares.length === 0 && "Sin titular informado"}
                {m.titulares.map((t, i) => (
                  <span key={i} className="titular">
                    {t.nombre}
                    {t.porcentaje !== null && t.porcentaje < 100 && <small>, {t.porcentaje}%</small>}
                    {t.cuit && <small className="num">, CUIT {t.cuit}</small>}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Rubro</dt>
              <dd>
                Clase {m.clase}, {m.clase > PRODUCTOS_HASTA ? "servicios" : "productos"}: {claseNombre(m.clase).toLowerCase()}
              </dd>
            </div>
            {m.tipo && (
              <div>
                <dt>Tipo de marca</dt>
                <dd>
                  {m.tipo}. {TIPOS[m.tipo] ?? ""}
                </dd>
              </div>
            )}
            <div>
              <dt>Fechas</dt>
              <dd>
                Pedida el {fmtFecha(m.ingreso)}
                {m.vencimiento && (
                  <>
                    <br />
                    {s === "vigente" ? "Vence" : "Venció"} el {fmtFecha(m.vencimiento)}, {tiempoHasta(m.vencimiento)}
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Expediente</dt>
              <dd className="num">
                Acta {m.acta}
                {m.resolucion && (
                  <>
                    <br />
                    Resolución {m.resolucion}
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </li>
  );
}

function Glosario({ abierto = false }: { abierto?: boolean }) {
  return (
    <details className="glosario" open={abierto}>
      <summary>Qué significa cada estado</summary>
      <div className="gl-grid">
        <dl className="gl-estados">
          {(Object.keys(SITUACIONES) as Situacion[])
            .filter((s) => s !== "otra")
            .map((s) => (
              <div key={s}>
                <dt>
                  <i className={`dot s-${s}`} aria-hidden />
                  {SITUACIONES[s].label}
                </dt>
                <dd>{SITUACIONES[s].explicacion}</dd>
              </div>
            ))}
        </dl>
        <div className="gl-notes">
          <h3>Clases</h3>
          <p>
            Cada marca se registra en una clase de la Clasificación de Niza: de la 1 a la 34 son productos y de la
            35 a la 45, servicios. Cada clase es una solicitud y un arancel aparte, y el derecho vale solo dentro de
            esa clase y de rubros muy cercanos.
          </p>
          <h3>Tipos de marca</h3>
          <p>
            {Object.entries(TIPOS).map(([t, d]) => (
              <span key={t} className="gl-tipo">
                <b>{t}.</b> {d}{" "}
              </span>
            ))}
          </p>
          <h3>Vigencia</h3>
          <p>
            Un registro dura 10 años desde que se concede y se renueva por otros 10. Entre el quinto y el sexto año
            el titular tiene que declarar que la usa. Si pasan 5 años sin uso, cualquiera puede pedir su caducidad.
          </p>
        </div>
      </div>
    </details>
  );
}
