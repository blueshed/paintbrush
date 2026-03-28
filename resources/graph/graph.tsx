/**
 * Graph explorer — demonstrates atomic multi-op deltas on a
 * person/role/activity graph stored as a single delta-ws document.
 *
 * Click to select → highlights cascade through the graph.
 * Click a highlighted item → toggles the association.
 * Deletes cascade atomically (one delta, multiple ops).
 */
import { signal, effect, pushDisposeScope, popDisposeScope } from "@blueshed/railroad/signals";
import { connect, type DeltaOp } from "@lib/delta-ws";
import type { GraphDoc, Activity, Role, Person } from "./graph-api";

const hub = connect("/ws");
const graph = hub.open<GraphDoc>("graph");

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

const selected = signal<{ type: "person" | "role" | "activity"; id: string } | null>(null);
const adding = signal<"person" | "role" | "activity" | null>(null);
const confirming = signal<string | null>(null);

// ---------------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------------

function getHighlights(doc: GraphDoc, sel: { type: string; id: string } | null) {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  const tertiary = new Set<string>();

  if (!sel) return { primary, secondary, tertiary };
  primary.add(sel.id);

  switch (sel.type) {
    case "person": {
      const person = doc.persons.find((p) => p.id === sel.id);
      if (person) {
        for (const rid of person.roles) secondary.add(rid);
        for (const r of doc.roles) {
          if (person.roles.includes(r.id)) {
            for (const aid of r.activities) tertiary.add(aid);
          }
        }
      }
      break;
    }
    case "role": {
      const role = doc.roles.find((r) => r.id === sel.id);
      if (role) for (const aid of role.activities) secondary.add(aid);
      for (const p of doc.persons) {
        if (p.roles.includes(sel.id)) secondary.add(p.id);
      }
      break;
    }
    case "activity": {
      for (const r of doc.roles) {
        if (r.activities.includes(sel.id)) {
          secondary.add(r.id);
          for (const p of doc.persons) {
            if (p.roles.includes(r.id)) tertiary.add(p.id);
          }
        }
      }
      break;
    }
  }

  return { primary, secondary, tertiary };
}

// ---------------------------------------------------------------------------
// Selection + toggle
// ---------------------------------------------------------------------------

function handleCardClick(type: "person" | "role" | "activity", id: string, e: Event) {
  e.stopPropagation();
  const sel = selected.peek();

  // Clicking the selected item deselects
  if (sel?.type === type && sel.id === id) {
    selected.set(null);
    return;
  }

  // Select this item
  selected.set({ type, id });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function addActivity(name: string) {
  graph.send([
    { op: "add", path: "/activities/-", value: { id: crypto.randomUUID(), name } },
  ]);
  adding.set(null);
}

function removeActivity(id: string) {
  const doc = graph.data.get()!;
  const idx = doc.activities.findIndex((a) => a.id === id);
  if (idx === -1) return;

  const ops: DeltaOp[] = [{ op: "remove", path: `/activities/${idx}` }];
  for (let i = 0; i < doc.roles.length; i++) {
    const filtered = doc.roles[i].activities.filter((aid) => aid !== id);
    if (filtered.length !== doc.roles[i].activities.length) {
      ops.push({ op: "replace", path: `/roles/${i}/activities`, value: filtered });
    }
  }

  graph.send(ops);
  if (selected.peek()?.id === id) selected.set(null);
  confirming.set(null);
}

function addRole(name: string) {
  graph.send([
    { op: "add", path: "/roles/-", value: { id: crypto.randomUUID(), name, activities: [] } },
  ]);
  adding.set(null);
}

function removeRole(id: string) {
  const doc = graph.data.get()!;
  const idx = doc.roles.findIndex((r) => r.id === id);
  if (idx === -1) return;

  const ops: DeltaOp[] = [{ op: "remove", path: `/roles/${idx}` }];
  for (let i = 0; i < doc.persons.length; i++) {
    const person = doc.persons[i];
    const filtered = person.roles.filter((rid) => rid !== id);
    if (filtered.length !== person.roles.length) {
      ops.push({ op: "replace", path: `/persons/${i}/roles`, value: filtered });
    }
    if (person.primaryRole === id) {
      ops.push({ op: "replace", path: `/persons/${i}/primaryRole`, value: filtered[0] ?? "" });
    }
  }

  graph.send(ops);
  if (selected.peek()?.id === id) selected.set(null);
  confirming.set(null);
}

function toggleActivityOnRole(roleId: string, activityId: string) {
  const doc = graph.data.get()!;
  const idx = doc.roles.findIndex((r) => r.id === roleId);
  if (idx === -1) return;

  const role = doc.roles[idx];
  const has = role.activities.includes(activityId);
  const activities = has
    ? role.activities.filter((id) => id !== activityId)
    : [...role.activities, activityId];

  graph.send([{ op: "replace", path: `/roles/${idx}/activities`, value: activities }]);
}

function addPerson(name: string) {
  graph.send([
    { op: "add", path: "/persons/-", value: { id: crypto.randomUUID(), name, primaryRole: "", roles: [] } },
  ]);
  adding.set(null);
}

function removePerson(id: string) {
  const doc = graph.data.get()!;
  const idx = doc.persons.findIndex((p) => p.id === id);
  if (idx === -1) return;
  graph.send([{ op: "remove", path: `/persons/${idx}` }]);
  if (selected.peek()?.id === id) selected.set(null);
  confirming.set(null);
}

function setPrimaryRole(personId: string, roleId: string) {
  const doc = graph.data.get()!;
  const idx = doc.persons.findIndex((p) => p.id === personId);
  if (idx === -1) return;

  const person = doc.persons[idx];
  const ops: DeltaOp[] = [
    { op: "replace", path: `/persons/${idx}/primaryRole`, value: roleId },
  ];
  if (roleId && !person.roles.includes(roleId)) {
    ops.push({ op: "replace", path: `/persons/${idx}/roles`, value: [...person.roles, roleId] });
  }
  graph.send(ops);
}

function toggleRoleOnPerson(personId: string, roleId: string) {
  const doc = graph.data.get()!;
  const idx = doc.persons.findIndex((p) => p.id === personId);
  if (idx === -1) return;

  const person = doc.persons[idx];
  const has = person.roles.includes(roleId);
  const roles = has
    ? person.roles.filter((id) => id !== roleId)
    : [...person.roles, roleId];

  const ops: DeltaOp[] = [
    { op: "replace", path: `/persons/${idx}/roles`, value: roles },
  ];
  if (has && person.primaryRole === roleId) {
    ops.push({ op: "replace", path: `/persons/${idx}/primaryRole`, value: roles[0] ?? "" });
  }
  graph.send(ops);
}

// ---------------------------------------------------------------------------
// Inline add helper
// ---------------------------------------------------------------------------

function addForm(type: "person" | "role" | "activity", onAdd: (name: string) => void): Node {
  if (adding.get() !== type) return document.createComment("");

  let input: HTMLInputElement;
  function submit() {
    const name = input.value.trim();
    if (name) onAdd(name);
  }

  return (
    <div class="add-form">
      <input
        ref={(el: HTMLInputElement) => { input = el; setTimeout(() => el.focus(), 0); }}
        placeholder="Name"
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") adding.set(null);
        }}
      />
      <button class="primary" onclick={submit}>Add</button>
      <button onclick={() => adding.set(null)}>Cancel</button>
    </div>
  ) as Node;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function GraphApp() {
  const el = <div class="graph-grid"></div> as HTMLElement;

  // Deselect when clicking outside cards
  el.addEventListener("click", () => selected.set(null));

  effect(() => {
    const doc = graph.data.get();
    if (!doc) {
      el.replaceChildren(<p style="padding:1.5rem">Loading graph...</p> as Node);
      return;
    }

    const sel = selected.get();
    const _add = adding.get();
    const conf = confirming.get();
    const { primary, secondary, tertiary } = getHighlights(doc, sel);

    function cls(id: string): string {
      if (primary.has(id)) return "card highlight-primary";
      if (secondary.has(id)) return "card highlight-secondary";
      if (tertiary.has(id)) return "card highlight-tertiary";
      return "card";
    }

    function roleName(id: string): string {
      return doc!.roles.find((r) => r.id === id)?.name ?? "—";
    }

    pushDisposeScope();
    el.replaceChildren(
      // --- Persons ---
      <section>
        <div class="toolbar">
          <h2>Persons</h2>
          <button onclick={(e: Event) => { e.stopPropagation(); adding.set("person"); }}>+ Add</button>
        </div>
        {addForm("person", addPerson)}
        {doc.persons.map((p) => (
          <div class={cls(p.id)} onclick={(e: Event) => handleCardClick("person", p.id, e)}>
            {conf === p.id && (
              <div class="confirm-overlay" onclick={(e: Event) => e.stopPropagation()}>
                <span>Delete {p.name}?</span>
                <button class="danger" onclick={() => removePerson(p.id)}>Yes</button>
                <button onclick={() => confirming.set(null)}>No</button>
              </div>
            )}
            <div class="card-header">
              <strong>{p.name}</strong>
              <button class="remove-btn" onclick={(e: Event) => { e.stopPropagation(); confirming.set(p.id); }}>×</button>
            </div>
            {sel?.type === "role"
              ? <label class="card-check" onclick={(e: Event) => e.stopPropagation()}>
                  <input type="checkbox" checked={p.roles.includes(sel.id)}
                    onchange={() => toggleRoleOnPerson(p.id, sel!.id)} />
                  {roleName(sel.id)}
                </label>
              : p.roles.length > 0
                ? <div class="card-meta">
                    {p.roles.map((rid, i) => [
                      i > 0 ? ", " : null,
                      sel?.type === "person" && sel.id === p.id
                        ? <span class={rid === p.primaryRole ? "role-tag primary" : "role-tag"}
                            onclick={(e: Event) => { e.stopPropagation(); setPrimaryRole(p.id, rid); }}>
                            {roleName(rid)}
                          </span>
                        : rid === p.primaryRole
                          ? <strong>{roleName(rid)}</strong>
                          : roleName(rid),
                    ])}
                  </div>
                : null
            }
          </div>
        ))}
      </section> as Node,

      // --- Roles ---
      <section>
        <div class="toolbar">
          <h2>Roles</h2>
          <button onclick={(e: Event) => { e.stopPropagation(); adding.set("role"); }}>+ Add</button>
        </div>
        {addForm("role", addRole)}
        {doc.roles.map((r) => (
          <div class={cls(r.id)} onclick={(e: Event) => handleCardClick("role", r.id, e)}>
            {conf === r.id && (
              <div class="confirm-overlay" onclick={(e: Event) => e.stopPropagation()}>
                <span>Delete {r.name}?</span>
                <button class="danger" onclick={() => removeRole(r.id)}>Yes</button>
                <button onclick={() => confirming.set(null)}>No</button>
              </div>
            )}
            <div class="card-header">
              <strong>{r.name}</strong>
              <button class="remove-btn" onclick={(e: Event) => { e.stopPropagation(); confirming.set(r.id); }}>×</button>
            </div>
            {sel?.type === "person"
              ? <label class="card-check" onclick={(e: Event) => e.stopPropagation()}>
                  <input type="checkbox" checked={doc!.persons.find((p) => p.id === sel.id)!.roles.includes(r.id)}
                    onchange={() => toggleRoleOnPerson(sel!.id, r.id)} />
                  {doc!.persons.find((p) => p.id === sel.id)!.name}
                </label>
              : sel?.type === "activity"
                ? <label class="card-check" onclick={(e: Event) => e.stopPropagation()}>
                    <input type="checkbox" checked={r.activities.includes(sel.id)}
                      onchange={() => toggleActivityOnRole(r.id, sel!.id)} />
                    {doc!.activities.find((a) => a.id === sel.id)!.name}
                  </label>
                : r.activities.length > 0
                  ? <div class="card-meta">
                      {r.activities.map((aid) => doc!.activities.find((a) => a.id === aid)?.name).filter(Boolean).join(", ")}
                    </div>
                  : null
            }
          </div>
        ))}
      </section> as Node,

      // --- Activities ---
      <section>
        <div class="toolbar">
          <h2>Activities</h2>
          <button onclick={(e: Event) => { e.stopPropagation(); adding.set("activity"); }}>+ Add</button>
        </div>
        {addForm("activity", addActivity)}
        {doc.activities.map((a) => (
          <div class={cls(a.id)} onclick={(e: Event) => handleCardClick("activity", a.id, e)}>
            {conf === a.id && (
              <div class="confirm-overlay" onclick={(e: Event) => e.stopPropagation()}>
                <span>Delete {a.name}?</span>
                <button class="danger" onclick={() => removeActivity(a.id)}>Yes</button>
                <button onclick={() => confirming.set(null)}>No</button>
              </div>
            )}
            <div class="card-header">
              <strong>{a.name}</strong>
              <button class="remove-btn" onclick={(e: Event) => { e.stopPropagation(); confirming.set(a.id); }}>×</button>
            </div>
            {sel?.type === "role"
              ? <label class="card-check" onclick={(e: Event) => e.stopPropagation()}>
                  <input type="checkbox" checked={doc!.roles.find((r) => r.id === sel.id)!.activities.includes(a.id)}
                    onchange={() => toggleActivityOnRole(sel!.id, a.id)} />
                  {doc!.roles.find((r) => r.id === sel.id)!.name}
                </label>
              : null
            }
          </div>
        ))}
      </section> as Node,
    );
    return popDisposeScope();
  });

  return el;
}

document.getElementById("app")!.append(<GraphApp />);
