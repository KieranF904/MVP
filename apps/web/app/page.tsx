"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import DriverHubClient from "./DriverHubClient";

type Role = "admin" | "dispatcher" | "driver";

type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
};

type AdminTab = "overview" | "users" | "documents" | "forms" | "training" | "assign";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export default function Home() {
  return <DriverHubClient />;
}

function LegacyHome() {
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [message, setMessage] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [training, setTraining] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(false);

  const authHeader = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  useEffect(() => {
    const saved = localStorage.getItem("driverHubAuth");
    if (!saved) {
      return;
    }

    const parsed = JSON.parse(saved) as { token: string; user: User };
    setToken(parsed.token);
    setUser(parsed.user);
  }, []);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    void refreshData(token, user);
  }, [token, user]);

  async function refreshData(activeToken: string, activeUser: User) {
    setLoading(true);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeToken}`,
    };

    const requestJson = async (path: string) => {
      const response = await fetch(`${API_URL}${path}`, { headers });
      if (!response.ok) {
        return [];
      }

      return (await response.json()) as any[];
    };

    if (activeUser.role === "driver") {
      const [taskData, trainingData, documentData, formData] = await Promise.all([
        requestJson("/tasks/my"),
        requestJson("/training/my"),
        requestJson("/documents"),
        requestJson("/dispo-forms"),
      ]);

      setTasks(taskData);
      setTraining(trainingData);
      setDocuments(documentData);
      setForms(formData);
      setLoading(false);
      return;
    }

    const [documentData, formData, userData, trainingData] = await Promise.all([
      requestJson("/documents"),
      requestJson("/dispo-forms"),
      requestJson("/users"),
      requestJson("/training/progress"),
    ]);

    setDocuments(documentData);
    setForms(formData);
    setUsers(userData as User[]);
    setTraining(trainingData);
    setLoading(false);
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setMessage("Login failed. Try demo credentials listed below.");
      return;
    }

    const data = await response.json();
    setToken(data.accessToken as string);
    setUser(data.user as User);
    localStorage.setItem(
      "driverHubAuth",
      JSON.stringify({ token: data.accessToken, user: data.user }),
    );
  }

  function logout() {
    setToken("");
    setUser(null);
    setTasks([]);
    setTraining([]);
    setDocuments([]);
    setForms([]);
    setUsers([]);
    localStorage.removeItem("driverHubAuth");
  }

  async function post(path: string, payload: object) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify(payload),
    });

    if (!response.ok || !user) {
      setMessage("Action failed. Check your role permissions.");
      return;
    }

    setMessage("Saved.");
    await refreshData(token, user);
  }

  async function patch(path: string, payload: object = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: authHeader,
      body: JSON.stringify(payload),
    });

    if (!response.ok || !user) {
      setMessage("Update failed.");
      return;
    }

    setMessage("Updated.");
    await refreshData(token, user);
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
        <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-2xl font-bold text-slate-900">Driver HUB</h1>
          <p className="mb-5 text-sm text-slate-600">Compliance workflow prototype</p>
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Demo logins: <br />
            <strong>admin / admin123</strong> <br />
            <strong>dispatcher / dispatcher123</strong> <br />
            <strong>driver1 / driver123</strong>
          </div>

          <form onSubmit={login} className="space-y-3">
            <input
              className="w-full rounded-lg border border-slate-300 p-2.5"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
          <input
              className="w-full rounded-lg border border-slate-300 p-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
          />
            <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-800">
              Sign in
            </button>
          </form>
          {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
        </section>
      </main>
    );
  }

  const pendingDocs = documents.filter((doc) => doc.status === "pending").length;
  const submittedForms = forms.filter((form) => form.status === "submitted").length;
  const pendingTraining = training.filter((item) => !item.confirmedAt).length;
  const driverUsers = users.filter((u) => u.role === "driver");

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Driver HUB</h1>
              <p className="text-sm text-slate-600">
                Welcome, {user.name} · <span className="capitalize">{user.role}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => user && refreshData(token, user)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Refresh
              </button>
              <button
                onClick={logout}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            Loading latest data...
          </p>
        ) : null}

      {user.role === "driver" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Assigned tasks" value={tasks.length} tone="blue" />
            <StatCard label="Pending training" value={pendingTraining} tone="amber" />
            <StatCard
              label="Documents pending review"
              value={documents.filter((d) => d.status === "pending").length}
              tone="purple"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="My Tasks" subtitle="Complete assigned compliance tasks">
              <ul className="space-y-2 text-sm">
                {tasks.length === 0 ? <Empty text="No tasks assigned." /> : null}
              {tasks.map((task) => (
                <li key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <strong>{task.title}</strong>
                    <StatusBadge value={task.status} />
                  </div>
                  <p className="mt-1 text-slate-700">{task.description}</p>
                  <p className="mt-2 text-xs text-slate-500">Due: {formatDate(task.dueDate)}</p>
                </li>
              ))}
              </ul>
            </Card>

            <Card title="Training Hub" subtitle="Confirm required onboarding training">
              <ul className="space-y-2 text-sm">
                {training.length === 0 ? <Empty text="No training assigned." /> : null}
              {training.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <strong>{item.module?.title}</strong>
                  <p className="mt-1 text-slate-700">{item.module?.content}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Status: {item.confirmedAt ? "Confirmed" : "Pending"}
                  </p>
                  {!item.confirmedAt ? (
                    <button
                      onClick={() => patch(`/training/${item.id}/confirm`)}
                      className="mt-2 rounded-lg bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800"
                    >
                      Confirm Seen
                    </button>
                  ) : null}
                </li>
              ))}
              </ul>
            </Card>

            <Card title="Upload Documents" subtitle="License and business documents">
              <SimpleForm
                fields={[
                  { key: "type", label: "Document type" },
                  { key: "fileName", label: "File name" },
                  { key: "notes", label: "Notes" },
                ]}
                onSubmit={(data) => post("/documents", data)}
                buttonLabel="Upload Document"
              />
              <SimpleTable
                columns={["Type", "File", "Status", "Uploaded"]}
                rows={documents.map((doc) => [
                  doc.type,
                  doc.fileName,
                  <StatusBadge key={`${doc.id}-status`} value={doc.status} />,
                  formatDate(doc.uploadedAt),
                ])}
                emptyText="No documents uploaded yet."
              />
            </Card>

            <Card title="Upload Vehicle / Business Photos" subtitle="Vehicle condition and proof photos">
              <SimpleForm
                fields={[
                  { key: "category", label: "Photo category" },
                  { key: "fileName", label: "File name" },
                  { key: "notes", label: "Notes" },
                ]}
                onSubmit={(data) => post("/photos", data)}
                buttonLabel="Upload Photo"
              />
            </Card>

            <Card
              title="Digital Driver Form"
              subtitle="Create form for dispatcher sign-off (paper replacement)"
            >
              <SimpleForm
                fields={[
                  { key: "title", label: "Form title" },
                  { key: "details", label: "Details" },
                ]}
                onSubmit={(data) => post("/dispo-forms", data)}
                buttonLabel="Create Form"
              />
              <SimpleTable
                columns={["Title", "Status", "Created"]}
                rows={forms.map((form) => [form.title, <StatusBadge key={form.id} value={form.status} />, formatDate(form.createdAt)])}
                emptyText="No forms created yet."
              />
            </Card>
          </div>
        </section>
      ) : null}

      {user.role === "dispatcher" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Drivers" value={driverUsers.length} tone="blue" />
            <StatCard label="Pending signatures" value={forms.filter((f) => f.status === "draft").length} tone="amber" />
            <StatCard label="Submitted forms" value={submittedForms} tone="green" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Assign Task to Driver">
              <SimpleForm
                fields={[
                  { key: "title", label: "Task title" },
                  { key: "description", label: "Task details" },
                  { key: "dueDate", label: "Due date (ISO)" },
                  { key: "driverId", label: "Driver ID" },
                ]}
                placeholders={{ dueDate: "2026-02-28T14:00:00.000Z", driverId: "u_driver_1" }}
                onSubmit={(data) => post("/tasks", data)}
                buttonLabel="Assign Task"
              />
            </Card>

            <Card title="Forms Waiting Signature" subtitle="Sign and submit driver forms">
              <ul className="space-y-2 text-sm">
                {forms.length === 0 ? <Empty text="No forms available." /> : null}
              {forms.map((form) => (
                <li key={form.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <strong>{form.title}</strong>
                    <StatusBadge value={form.status} />
                  </div>
                  <p className="mt-1 text-slate-700">{form.details}</p>
                  {form.status === "draft" ? (
                    <button
                      className="mt-2 rounded-lg bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800"
                      onClick={() => patch(`/dispo-forms/${form.id}/sign-dispatcher`)}
                    >
                      Sign + Submit
                    </button>
                  ) : null}
                </li>
              ))}
              </ul>
            </Card>

            <Card title="Driver List" subtitle="Quick list of active users">
              <SimpleTable
                columns={["Name", "Username", "Role", "ID"]}
                rows={users.map((u) => [u.name, u.username, <RolePill key={`${u.id}-role`} role={u.role} />, u.id])}
                emptyText="No users loaded."
              />
            </Card>

            <Card title="Training Progress (Read-Only)">
              <SimpleTable
                columns={["Driver", "Training", "Status"]}
                rows={training.map((item) => [
                  item.driver?.name ?? "Unknown",
                  item.module?.title ?? "Training",
                  item.confirmedAt ? "Confirmed" : "Pending",
                ])}
                emptyText="No training assignments found."
              />
            </Card>
          </div>
        </section>
      ) : null}

      {user.role === "admin" ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Users" value={users.length} tone="blue" />
            <StatCard label="Driver accounts" value={driverUsers.length} tone="purple" />
            <StatCard label="Docs to review" value={pendingDocs} tone="amber" />
            <StatCard label="Submitted forms" value={submittedForms} tone="green" />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <TabButton label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <TabButton label="Users" active={activeTab === "users"} onClick={() => setActiveTab("users")} />
            <TabButton label="Documents" active={activeTab === "documents"} onClick={() => setActiveTab("documents")} />
            <TabButton label="Forms" active={activeTab === "forms"} onClick={() => setActiveTab("forms")} />
            <TabButton label="Training" active={activeTab === "training"} onClick={() => setActiveTab("training")} />
            <TabButton label="Assign Task" active={activeTab === "assign"} onClick={() => setActiveTab("assign")} />
          </div>

          {activeTab === "overview" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Pending Document Reviews">
                <SimpleTable
                  columns={["Driver", "Type", "File", "Status"]}
                  rows={documents
                    .filter((d) => d.status === "pending")
                    .map((d) => [d.driverId, d.type, d.fileName, <StatusBadge key={d.id} value={d.status} />])}
                  emptyText="No pending documents."
                />
              </Card>
              <Card title="Submitted Forms Awaiting Review">
                <SimpleTable
                  columns={["Driver", "Title", "Status"]}
                  rows={forms
                    .filter((f) => f.status === "submitted")
                    .map((f) => [f.driverId, f.title, <StatusBadge key={f.id} value={f.status} />])}
                  emptyText="No forms waiting review."
                />
              </Card>
            </div>
          ) : null}

          {activeTab === "users" ? (
            <Card title="User List" subtitle="Visible and manageable list for admins">
              <SimpleTable
                columns={["Name", "Username", "Role", "User ID"]}
                rows={users.map((u) => [u.name, u.username, <RolePill key={`${u.id}-role`} role={u.role} />, u.id])}
                emptyText="No users found."
              />
            </Card>
          ) : null}

          {activeTab === "documents" ? (
            <Card title="Document Review Queue">
              <ul className="space-y-3 text-sm">
                {documents.length === 0 ? <Empty text="No documents uploaded yet." /> : null}
                {documents.map((document) => (
                  <li key={document.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {document.type} · {document.fileName}
                      </p>
                      <StatusBadge value={document.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Driver: {document.driverId}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => patch(`/documents/${document.id}/review`, { decision: "approved" })}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          patch(`/documents/${document.id}/review`, {
                            decision: "rejected",
                            comment: "Please re-upload a clearer image",
                          })
                        }
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {activeTab === "forms" ? (
            <Card title="Digital Form Review List" subtitle="Dispo signed forms">
              <ul className="space-y-3 text-sm">
                {forms.length === 0 ? <Empty text="No forms found." /> : null}
                {forms.map((form) => (
                  <li key={form.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <strong>{form.title}</strong>
                      <StatusBadge value={form.status} />
                    </div>
                    <p className="mt-1 text-slate-700">{form.details}</p>
                    <p className="mt-1 text-xs text-slate-500">Driver: {form.driverId}</p>
                    {form.status === "submitted" ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() =>
                            patch(`/dispo-forms/${form.id}/review`, {
                              decision: "approved",
                              comment: "Looks good",
                            })
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            patch(`/dispo-forms/${form.id}/review`, {
                              decision: "rejected",
                              comment: "Missing details",
                            })
                          }
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {activeTab === "training" ? (
            <Card title="Training Progress">
              <SimpleTable
                columns={["Driver", "Training", "Status", "Confirmed At"]}
                rows={training.map((item) => [
                  item.driver?.name ?? "Unknown",
                  item.module?.title ?? "Training",
                  item.confirmedAt ? "Confirmed" : "Pending",
                  item.confirmedAt ? formatDate(item.confirmedAt) : "-",
                ])}
                emptyText="No training progress available."
              />
            </Card>
          ) : null}

          {activeTab === "assign" ? (
            <Card title="Assign Task to Driver">
              <SimpleForm
                fields={[
                  { key: "title", label: "Task title" },
                  { key: "description", label: "Task details" },
                  { key: "dueDate", label: "Due date (ISO)" },
                  { key: "driverId", label: "Driver ID" },
                ]}
                placeholders={{ dueDate: "2026-02-28T14:00:00.000Z", driverId: "u_driver_1" }}
                onSubmit={(data) => post("/tasks", data)}
                buttonLabel="Assign Task"
              />
            </Card>
          ) : null}
        </section>
      ) : null}

        {message ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle ? <p className="mb-3 text-sm text-slate-500">{subtitle}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function StatusBadge({ value }: { value: string }) {
  const text = value.toLowerCase();
  const styles =
    text === "approved" || text === "confirmed" || text === "submitted"
      ? "bg-emerald-100 text-emerald-700"
      : text === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{value}</span>;
}

function RolePill({ role }: { role: Role }) {
  const styles =
    role === "admin"
      ? "bg-purple-100 text-purple-700"
      : role === "dispatcher"
        ? "bg-blue-100 text-blue-700"
        : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{role}</span>;
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "blue" | "amber" | "green" | "purple" }) {
  const toneClass =
    tone === "blue"
      ? "from-blue-50 to-blue-100 text-blue-800"
      : tone === "amber"
        ? "from-amber-50 to-amber-100 text-amber-800"
        : tone === "green"
          ? "from-emerald-50 to-emerald-100 text-emerald-800"
          : "from-purple-50 to-purple-100 text-purple-800";

  return (
    <div className={`rounded-2xl border border-slate-200 bg-gradient-to-b p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`m-1 rounded-lg px-3 py-1.5 text-sm ${
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function SimpleTable({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: (ReactNode | string)[][];
  emptyText: string;
}) {
  if (!rows.length) {
    return <Empty text={emptyText} />;
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="bg-white">
              {row.map((cell, j) => (
                <td key={`${i}-${j}`} className="px-3 py-2 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">{text}</p>;
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function SimpleForm({
  fields,
  placeholders,
  onSubmit,
  buttonLabel,
}: {
  fields: Array<{ key: string; label: string }>;
  placeholders?: Record<string, string>;
  onSubmit: (data: Record<string, string>) => void;
  buttonLabel: string;
}) {
  const [data, setData] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(data);
        setData({});
      }}
    >
      {fields.map((field) => (
        <label key={field.key} className="block text-xs font-medium text-slate-600">
          {field.label}
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder={placeholders?.[field.key] ?? field.label}
            value={data[field.key] ?? ""}
            onChange={(event) =>
              setData((current) => ({
                ...current,
                [field.key]: event.target.value,
              }))
            }
          />
        </label>
      ))}
      <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
        {buttonLabel}
      </button>
    </form>
  );
}
