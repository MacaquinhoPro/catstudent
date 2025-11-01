import React, { useMemo, useState } from "react";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  HttpLink,
  gql,
  useApolloClient,
} from "@apollo/client";

/* ============================================================
   CONFIG
   ============================================================ */
const API_URL = "https://cats-students-api.vercel.app/api/graphql";

const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: API_URL, fetch }),
  cache: new InMemoryCache(),
});

/* ============================================================
   UI HELPERS
   ============================================================ */
const Shell = ({ children }) => (
  <div className="min-h-screen bg-slate-900 text-white">
    <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-slate-900/70 bg-slate-900/90 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <h1 className="text-xl md:text-2xl font-bold">Cats (by Breed) + Students · GraphQL Client</h1>
        <p className="text-xs md:text-sm opacity-70">
          Nada cambia hasta presionar <strong>“Consultar”</strong>. Los campos/params solo se aplican al ejecutar.
        </p>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
  </div>
);

const Panel = ({ title, subtitle, actions, left, right, aside }) => (
  <section className="mb-8">
    <div className="grid xl:grid-cols-12 gap-6">
      <div className="xl:col-span-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 shadow-lg">
          <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {subtitle && <p className="text-sm opacity-70 mt-1">{subtitle}</p>}
            </div>
            {actions}
          </div>
          <div className="p-5 grid lg:grid-cols-2 gap-5">
            <div>{left}</div>
            <div>{right}</div>
          </div>
        </div>
      </div>
      <div className="xl:col-span-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 shadow-lg">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-medium">Request body (pendiente)</h3>
            <p className="text-xs opacity-60">Esto es lo que se enviará al presionar “Consultar”.</p>
          </div>
          <div className="p-4">{aside}</div>
        </div>
      </div>
    </div>
  </section>
);

const FieldGrid = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">{children}</div>
);

const Checkbox = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <input
      type="checkbox"
      className="w-4 h-4 rounded border-white/20 bg-transparent"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="text-sm">{label}</span>
  </label>
);

const CodeBlock = ({ children }) => (
  <pre className="text-xs whitespace-pre-wrap leading-5 bg-black/40 border border-white/10 rounded-xl p-3 overflow-auto max-h-[360px]">
    {children}
  </pre>
);

const Pill = ({ children }) => (
  <span className="inline-block text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10 mr-2 mb-2">
    {children}
  </span>
);

/* ============================================================
   UTIL
   ============================================================ */
function buildSelection(fields) {
  const safe = Array.isArray(fields) ? fields : [];
  const body = safe.map((f) => {
    if (f === "breeds") return "breeds { id name }";
    if (f === "categories") return "categories { id name }";
    return f;
  });
  return body.length ? body.join("\n") : "id";
}

/* ============================================================
   SECCIÓN 1: GATOS (con estado PENDIENTE vs APLICADO)
   ============================================================ */

const CAT_FIELDS = [
  { key: "id", label: "id" },
  { key: "url", label: "url (imagen)" },
  { key: "width", label: "width" },
  { key: "height", label: "height" },
  { key: "breeds", label: "breeds { name }" },
  { key: "categories", label: "categories { name }" },
];

function CatCard({ item, selected }) {
  const has = (k) => selected.includes(k);
  return (
    <div className="border border-white/10 rounded-xl p-3">
      {has("url") && item.url ? (
        <img src={item.url} alt={item.id || "cat"} className="w-full h-44 object-cover rounded-lg mb-3" />
      ) : (
        <div className="w-full h-44 rounded-lg bg-white/5 grid place-items-center mb-3 text-xs opacity-70">
          Imagen no seleccionada
        </div>
      )}
      <div className="flex flex-wrap">
        {has("id") && item.id && <Pill>ID: {item.id}</Pill>}
        {has("width") && item.width != null && <Pill>Width: {item.width}</Pill>}
        {has("height") && item.height != null && <Pill>Height: {item.height}</Pill>}
        {has("breeds") && Array.isArray(item.breeds) && item.breeds.length > 0 && (
          <Pill>Breeds: {item.breeds.map((b) => b.name).join(", ")}</Pill>
        )}
        {has("categories") && Array.isArray(item.categories) && item.categories.length > 0 && (
          <Pill>Categories: {item.categories.map((c) => c.name).join(", ")}</Pill>
        )}
      </div>
    </div>
  );
}

function CatSection() {
  const client = useApolloClient();

  // ====== PENDIENTE (UI) — NO afecta lo que se muestra hasta aplicar
  const [pendingSelected, setPendingSelected] = useState(["id", "url", "breeds"]);
  const [pendingBreedId, setPendingBreedId] = useState("");
  const [pendingLimit, setPendingLimit] = useState(3);

  // ====== APLICADO (lo que se usó en última consulta) — SOLO esto renderiza
  const [appliedSelected, setAppliedSelected] = useState(["id", "url", "breeds"]);
  const [appliedBreedId, setAppliedBreedId] = useState("");
  const [appliedLimit, setAppliedLimit] = useState(3);

  // ====== Resultados de la última ejecución
  const [catData, setCatData] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState(null);

  // Body PENDIENTE (lo que se enviará al presionar)
  const { queryTextPending, variablesPending, requestBody } = useMemo(() => {
    const selection = buildSelection(pendingSelected);
    const useBreed = Boolean(pendingBreedId && String(pendingBreedId).trim().length > 0);
    const textWithBreed = `
      query CatImages($limit: Int!, $breedId: ID!) {
        catImages(limit: $limit, breedId: $breedId) {
          ${selection}
        }
      }
    `;
    const textNoBreed = `
      query CatImages($limit: Int!) {
        catImages(limit: $limit) {
          ${selection}
        }
      }
    `;
    const vars = useBreed
      ? { limit: Math.max(1, Math.min(20, Number(pendingLimit) || 1)), breedId: String(pendingBreedId).trim() }
      : { limit: Math.max(1, Math.min(20, Number(pendingLimit) || 1)) };

    const text = (useBreed ? textWithBreed : textNoBreed).trim();
    return {
      queryTextPending: text,
      variablesPending: vars,
      requestBody: {
        method: "POST",
        url: API_URL,
        headers: { "content-type": "application/json" },
        payload: {
          operationName: "CatImages",
          variables: vars,
          query: text,
        },
      },
    };
  }, [pendingSelected, pendingBreedId, pendingLimit]);

  // Ejecutar y APLICAR
  const runCats = async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const result = await client.query({
        query: gql(queryTextPending),
        variables: variablesPending,
        fetchPolicy: "no-cache",
      });
      setCatData(result.data);

      // APLICAR estados (congelar lo que se muestra)
      setAppliedSelected(pendingSelected);
      setAppliedBreedId(pendingBreedId);
      setAppliedLimit(variablesPending.limit);
    } catch (e) {
      setCatError(e);
    } finally {
      setCatLoading(false);
    }
  };

  const togglePending = (key, val) =>
    setPendingSelected((prev) => (val ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));

  const left = (
    <>
      <div className="space-y-3">
        <div>
          <label className="text-sm opacity-80">Breed ID (opcional):</label>
          <input
            type="text"
            className="mt-1 block w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20"
            placeholder="ej: abys"
            value={pendingBreedId}
            onChange={(e) => setPendingBreedId(e.target.value)}
          />
          <p className="text-xs opacity-60 mt-1">Vacío = consulta sin <code>breedId</code>.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-80"># resultados:</label>
          <input
            type="number"
            min={1}
            max={20}
            className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 w-24"
            value={pendingLimit}
            onChange={(e) => setPendingLimit(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm opacity-80 mt-4 mb-2">Campos fijos (elige cuáles mostrar):</p>
      <FieldGrid>
        {CAT_FIELDS.map((f) => (
          <Checkbox
            key={f.key}
            label={f.label}
            checked={pendingSelected.includes(f.key)}
            onChange={(v) => togglePending(f.key, v)}
          />
        ))}
      </FieldGrid>
      <p className="text-xs opacity-60 mt-2">Lo seleccionado aquí no se aplica hasta presionar “Consultar”.</p>
    </>
  );

  const right = (
    <>
      <p className="text-sm opacity-80 mb-2">Resultados (última ejecución aplicada)</p>
      <div className="text-xs opacity-60 mb-2">
        <span className="mr-3">Campos aplicados: {appliedSelected.join(", ") || "—"}</span>
        <span className="mr-3">breedId: {appliedBreedId || "—"}</span>
        <span>limit: {appliedLimit}</span>
      </div>
      {catLoading && <p className="text-sm opacity-80">Consultando…</p>}
      {catError && <p className="text-sm text-red-300">Error: {catError.message}</p>}
      {catData?.catImages?.length ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {catData.catImages.map((img, i) => (
            <CatCard key={i} item={img} selected={appliedSelected} />
          ))}
        </div>
      ) : (
        !catLoading && <p className="text-sm opacity-70">Aún no hay resultados.</p>
      )}
    </>
  );

  const aside = (
    <>
      <p className="text-xs mb-2 opacity-70">HTTP request body (pendiente)</p>
      <CodeBlock>{JSON.stringify(requestBody, null, 2)}</CodeBlock>
    </>
  );

  const actions = (
    <button
      className="px-4 py-2 rounded-xl bg-white/90 text-black font-medium hover:bg-white"
      onClick={runCats}
    >
      Consultar
    </button>
  );

  return (
    <Panel
      title="Gatos por raza (breedId)"
      subtitle="La consulta y la aplicación de campos suceden solo al presionar el botón."
      actions={actions}
      left={left}
      right={right}
      aside={aside}
    />
  );
}

/* ============================================================
   SECCIÓN 2: ESTUDIANTES (con estado PENDIENTE vs APLICADO)
   ============================================================ */

const STUDENT_FIELDS = [
  { key: "id", label: "id" },
  { key: "name", label: "name" },
  { key: "age", label: "age" },
  { key: "program", label: "program" },
  { key: "gpa", label: "gpa" },
  { key: "email", label: "email" },
];

function StudentsSection() {
  const client = useApolloClient();

  // PENDIENTE (UI)
  const [pendingSelected, setPendingSelected] = useState(["id", "name", "program", "gpa"]);
  // APLICADO (render)
  const [appliedSelected, setAppliedSelected] = useState(["id", "name", "program", "gpa"]);

  // Resultados de última ejecución
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // Query fijo (siempre todos)
  const { queryText, requestBody } = useMemo(() => {
    const text = `
      query AllStudents {
        students {
          id
          name
          age
          program
          gpa
          email
        }
      }
    `.trim();

    return {
      queryText: text,
      requestBody: {
        method: "POST",
        url: API_URL,
        headers: { "content-type": "application/json" },
        payload: {
          operationName: "AllStudents",
          variables: {},
          query: text,
        },
      },
    };
  }, []);

  const runStudents = async () => {
    setLoading(true);
    setErr(null);
    try {
      const result = await client.query({
        query: gql(queryText),
        variables: {},
        fetchPolicy: "no-cache",
      });
      setData(result.data);

      // APLICAR columnas para render
      setAppliedSelected(pendingSelected);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  };

  const togglePending = (key, val) =>
    setPendingSelected((prev) => (val ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));

  const students = data?.students || [];

  const left = (
    <>
      <p className="text-sm opacity-80 mb-2">Campos fijos (elige cuáles mostrar en la tabla):</p>
      <FieldGrid>
        {STUDENT_FIELDS.map((f) => (
          <Checkbox
            key={f.key}
            label={f.label}
            checked={pendingSelected.includes(f.key)}
            onChange={(v) => togglePending(f.key, v)}
          />
        ))}
      </FieldGrid>
      <p className="text-xs opacity-60 mt-2">Lo seleccionado aquí no se aplica hasta presionar “Consultar”.</p>
    </>
  );

  const right = (
    <>
      <p className="text-sm opacity-80 mb-2">Resultado (última ejecución aplicada)</p>
      <div className="text-xs opacity-60 mb-2">
        <span>Columnas aplicadas: {appliedSelected.join(", ") || "—"}</span>
      </div>
      {loading && <p className="text-sm opacity-80">Consultando…</p>}
      {err && <p className="text-sm text-red-300">Error: {err.message}</p>}
      {students.length ? (
        <div className="overflow-auto border border-white/10 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-white/10">
              <tr>
                {appliedSelected.map((c) => (
                  <th key={c} className="text-left font-semibold px-3 py-2 capitalize">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="odd:bg-white/5">
                  {appliedSelected.map((c) => (
                    <td key={c} className="px-3 py-2 align-top">
                      {typeof s[c] === "object" ? JSON.stringify(s[c]) : String(s[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && <p className="text-sm opacity-70">Aún no hay resultados.</p>
      )}
    </>
  );

  const aside = (
    <>
      <p className="text-xs mb-2 opacity-70">HTTP request body (pendiente)</p>
      <CodeBlock>{JSON.stringify(requestBody, null, 2)}</CodeBlock>
    </>
  );

  const actions = (
    <button
      className="px-4 py-2 rounded-xl bg-white/90 text-black font-medium hover:bg-white"
      onClick={runStudents}
    >
      Consultar
    </button>
  );

  return (
    <Panel
      title="Estudiantes (todos)"
      subtitle="La consulta y la aplicación de columnas suceden solo al presionar el botón."
      actions={actions}
      left={left}
      right={right}
      aside={aside}
    />
  );
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Shell>
        <CatSection />
        <StudentsSection />
      </Shell>
    </ApolloProvider>
  );
}
