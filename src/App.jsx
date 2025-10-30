import React, { useMemo, useState } from "react";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  ApolloLink,
  from,
  gql,
  useLazyQuery,
} from "@apollo/client";
import { RestLink } from "apollo-link-rest";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { SchemaLink } from "@apollo/client/link/schema";

/* ============================================================
   APOLLO: CAT API (REST via @rest) + STUDENTS (SchemaLink local)
   ============================================================ */

const CAT_API_KEY =
  "live_UiTHW0pEyWvmlHCs06sqnr3UazV3Fdf8I3qasOkOGVkumI0DZrWovno4DQssBS7J";

// A) RestLink para The Cat API
const restLink = new RestLink({
  uri: "https://api.thecatapi.com/v1",
  headers: { "x-api-key": CAT_API_KEY },
});

// B) Schema local in-memory para Students
const typeDefs = /* GraphQL */ `
  type Student {
    id: ID!
    name: String!
    age: Int!
    program: String!
    gpa: Float!
    email: String!
  }

  type Query {
    students: [Student!]!
  }
`;

const STUDENTS_DB = [
  { id: "1", name: "María López", age: 20, program: "Comunicación", gpa: 4.3, email: "maria.lopez@example.com" },
  { id: "2", name: "Juan Restrepo", age: 22, program: "Ing. Informática", gpa: 4.1, email: "juan.restrepo@example.com" },
  { id: "3", name: "Nicolás Urrea", age: 21, program: "Diseño", gpa: 3.9, email: "nicolas.urrea@example.com" },
  { id: "4", name: "Samuel Acero", age: 23, program: "Administración", gpa: 4.5, email: "samuel.acero@example.com" },
];

const resolvers = {
  Query: { students: () => STUDENTS_DB },
};

const studentsSchema = makeExecutableSchema({ typeDefs, resolvers });
const schemaLink = new SchemaLink({ schema: studentsSchema });

// C) Split: si el contexto trae useRest=true => restLink; si no => schemaLink
const splitLink = ApolloLink.split(
  (operation) => operation.getContext().useRest === true,
  restLink,
  schemaLink
);

const client = new ApolloClient({
  link: from([splitLink]),
  cache: new InMemoryCache(),
});

/* ============================================================
   UI HELPERS
   ============================================================ */

const Shell = ({ children }) => (
  <div className="min-h-screen bg-slate-900 text-white">
    <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-slate-900/70 bg-slate-900/90 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <h1 className="text-xl md:text-2xl font-bold">GraphQL · The Cat API + Students</h1>
        <p className="text-xs md:text-sm opacity-70">
          Dos secciones: selecciona campos, ejecuta y revisa el request body a la derecha.
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
            <h3 className="font-medium">Request body</h3>
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

function buildSelection(fields) {
  const safe = Array.isArray(fields) ? fields : [];
  const body = safe.map((f) => {
    if (f === "breeds") return "breeds { id name }";
    if (f === "categories") return "categories { id name }";
    return f;
  });
  return body.length ? body.join("\n") : "id";
}

function maskKey(k) {
  if (!k) return k;
  if (k.length <= 10) return "•••";
  return k.slice(0, 6) + "•••" + k.slice(-4);
}

/* ============================================================
   SECCIÓN 1: THE CAT API (GraphQL sobre REST)
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
      {/* Imagen solo si el usuario seleccionó url */}
      {has("url") && item.url ? (
        <img
          src={item.url}
          alt={item.id || "cat"}
          className="w-full h-44 object-cover rounded-lg mb-3"
        />
      ) : (
        <div className="w-full h-44 rounded-lg bg-white/5 grid place-items-center mb-3 text-xs opacity-70">
          Imagen no seleccionada
        </div>
      )}

      {/* Pills con los campos seleccionados */}
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
  const [selected, setSelected] = useState(["id", "url"]);
  const [limit, setLimit] = useState(3);

  // Construcción de query y de request body (REST) — se actualiza con checkboxes y límite.
  const { queryDoc, variables, requestBody } = useMemo(() => {
    const selection = buildSelection(selected);
    const text = `
      query CatImages($limit: Int!) {
        catImages(limit: $limit)
          @rest(type: "CatImage", path: "/images/search?limit={args.limit}") {
          ${selection}
        }
      }
    `;
    const vars = { limit: Math.max(1, Math.min(20, Number(limit) || 1)) };

    // Nota: TheCatAPI es GET. El cuerpo "real" no lleva selección,
    // pero mostramos un body descriptivo que incluye params y los campos seleccionados
    // (útil para entender qué se está pidiendo desde la UI).
    const body = {
      method: "GET",
      url: `https://api.thecatapi.com/v1/images/search`,
      headers: { "x-api-key": maskKey(CAT_API_KEY) },
      params: { limit: vars.limit },
      selectedFields: selected, // <- cambia al marcar/desmarcar
      payload: null,
    };

    return {
      queryDoc: gql(text),
      variables: vars,
      requestBody: body,
    };
  }, [selected, limit]);

  const [runQuery, { data, loading, error }] = useLazyQuery(queryDoc, {
    context: { useRest: true },
  });

  const toggle = (key, val) =>
    setSelected((prev) => (val ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));

  const left = (
    <>
      <p className="text-sm opacity-80 mb-2">Campos disponibles</p>
      <FieldGrid>
        {CAT_FIELDS.map((f) => (
          <Checkbox
            key={f.key}
            label={f.label}
            checked={selected.includes(f.key)}
            onChange={(v) => toggle(f.key, v)}
          />
        ))}
      </FieldGrid>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-sm opacity-80"># resultados:</label>
        <input
          type="number"
          min={1}
          max={20}
          className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 w-24"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </div>
    </>
  );

  const right = (
    <>
      <p className="text-sm opacity-80 mb-2">Resultados</p>
      {loading && <p className="text-sm opacity-80">Consultando…</p>}
      {error && <p className="text-sm text-red-300">Error: {error.message}</p>}
      {data?.catImages?.length ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.catImages.map((img, i) => (
            <CatCard key={i} item={img} selected={selected} />
          ))}
        </div>
      ) : (
        !loading && <p className="text-sm opacity-70">Aún no hay resultados.</p>
      )}
    </>
  );

  const aside = (
    <>
      <p className="text-xs mb-2 opacity-70">HTTP request (REST)</p>
      <CodeBlock>{JSON.stringify(requestBody, null, 2)}</CodeBlock>
    </>
  );

  const actions = (
    <button
      className="px-4 py-2 rounded-xl bg-white/90 text-black font-medium hover:bg-white"
      onClick={() => runQuery({ variables })}
    >
      Consultar
    </button>
  );

  return (
    <Panel
      title="The Cat API (GraphQL @rest)"
      subtitle="Selecciona datos y ejecuta. A la derecha: el cuerpo de la request (con params y campos seleccionados)."
      actions={actions}
      left={left}
      right={right}
      aside={aside}
    />
  );
}

/* ============================================================
   SECCIÓN 2: STUDENTS (GraphQL local)
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
  const [selected, setSelected] = useState(["id", "name", "program", "gpa"]);

  const { queryDoc, bodyPreview } = useMemo(() => {
    const selection = buildSelection(selected);
    const text = `
      query AllStudents {
        students {
          ${selection}
        }
      }
    `;
    // Body típico de request GraphQL (para referencia visual del "body")
    const body = {
      method: "POST",
      url: "/graphql",
      headers: { "content-type": "application/json" },
      payload: {
        operationName: "AllStudents",
        variables: {},
        query: text.trim(),
      },
    };
    return {
      queryDoc: gql(text),
      bodyPreview: body,
    };
  }, [selected]);

  const [runQuery, { data, loading, error }] = useLazyQuery(queryDoc);

  const toggle = (key, val) =>
    setSelected((prev) => (val ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));

  const students = data?.students || [];

  const left = (
    <>
      <p className="text-sm opacity-80 mb-2">Campos disponibles</p>
      <FieldGrid>
        {STUDENT_FIELDS.map((f) => (
          <Checkbox
            key={f.key}
            label={f.label}
            checked={selected.includes(f.key)}
            onChange={(v) => toggle(f.key, v)}
          />
        ))}
      </FieldGrid>
    </>
  );

  const right = (
    <>
      <p className="text-sm opacity-80 mb-2">Resultado</p>
      {loading && <p className="text-sm opacity-80">Consultando…</p>}
      {error && <p className="text-sm text-red-300">Error: {error.message}</p>}
      {students.length ? (
        <div className="overflow-auto border border-white/10 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-white/10">
              <tr>
                {selected.map((c) => (
                  <th key={c} className="text-left font-semibold px-3 py-2 capitalize">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="odd:bg-white/5">
                  {selected.map((c) => (
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
      <p className="text-xs mb-2 opacity-70">GraphQL request body (referencial)</p>
      <CodeBlock>{JSON.stringify(bodyPreview, null, 2)}</CodeBlock>
    </>
  );

  const actions = (
    <button
      className="px-4 py-2 rounded-xl bg-white/90 text-black font-medium hover:bg-white"
      onClick={() => runQuery()}
    >
      Consultar
    </button>
  );

  return (
    <Panel
      title="Students (SchemaLink local)"
      subtitle="Selecciona columnas. A la derecha: body típico de GraphQL actualizado según tu selección."
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
    <ApolloProvider client={client}>
      <Shell>
        <CatSection />
        <StudentsSection />
      </Shell>
    </ApolloProvider>
  );
}
