"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Role = "admin" | "dispatcher" | "driver";

type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
};

type RequiredDocument = {
  id: string;
  title: string;
  description: string;
  type: string;
};

type TaskTemplate = {
  id: string;
  title: string;
  description: string;
  requiredDocuments: RequiredDocument[];
};

type DriverTask = {
  id: string;
  templateId: string;
  dueDate: string;
  driverId?: string;
  status: "assigned" | "submitted" | "approved" | "resubmit_required";
  reviewFeedback?: string;
  submittedDocuments: Array<{ requirementId: string; fileName: string; notes?: string }>;
  template?: TaskTemplate;
  driver?: User;
};

type DriverDocument = {
  id: string;
  driverId?: string;
  type: string;
  fileName: string;
  notes?: string;
  status: "pending" | "approved" | "rejected";
  uploadedAt?: string;
};

function resolveApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured && configured.trim().length > 0) {
    return configured;
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("fly.dev")) {
      return "https://mvp-api-kiera-0224.fly.dev";
    }
  }

  return "http://localhost:4001";
}

export default function DriverHubClient() {
  const API_URL = useMemo(() => resolveApiUrl(), []);
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [driverTasks, setDriverTasks] = useState<DriverTask[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<DriverTask[]>([]);
  const [reviewQueue, setReviewQueue] = useState<DriverTask[]>([]);

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementDescription, setRequirementDescription] = useState("");
  const [requirementType, setRequirementType] = useState("document");
  const [requirementsDraft, setRequirementsDraft] = useState<
    Array<{ title: string; description: string; type: string }>
  >([]);

  const [assignTemplateId, setAssignTemplateId] = useState("");
  const [assignDriverId, setAssignDriverId] = useState("u_driver_1");
  const [assignDueDate, setAssignDueDate] = useState("2026-03-01T12:00:00.000Z");

  const [taskSubmissions, setTaskSubmissions] = useState<
    Record<string, { files: Record<string, string>; notes: string }>
  >({});

  const [reviewFeedbackDraft, setReviewFeedbackDraft] = useState<Record<string, string>>({});

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

  async function request(path: string, options?: RequestInit) {
    const response = await fetch(`${API_URL}${path}`, {
      headers: authHeader,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${path}`);
    }

    return response.json();
  }

  async function refreshData(activeToken: string, activeUser: User) {
    setLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeToken}`,
      };
      const safeGet = async (path: string) => {
        const response = await fetch(`${API_URL}${path}`, { headers });
        if (!response.ok) {
          return [];
        }
        return response.json();
      };

      if (activeUser.role === "driver") {
        const [taskData, documentData] = await Promise.all([
          safeGet("/tasks/my"),
          safeGet("/documents"),
        ]);
        setDriverTasks(taskData as DriverTask[]);
        setDocuments(documentData as DriverDocument[]);
      } else {
        const [userData, templateData, assignedData, documentData] = await Promise.all([
          safeGet("/users"),
          safeGet("/task-templates"),
          safeGet("/tasks/assigned"),
          safeGet("/documents"),
        ]);

        setUsers(userData as User[]);
        setTaskTemplates(templateData as TaskTemplate[]);
        setAssignedTasks(assignedData as DriverTask[]);
        setDocuments(documentData as DriverDocument[]);

        if (activeUser.role === "admin") {
          const queue = await safeGet("/tasks/review-queue");
          setReviewQueue(queue as DriverTask[]);
        } else {
          setReviewQueue([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setMessage("Login failed. Please check username and password.");
      return;
    }

    const data = await response.json();
    setToken(data.accessToken as string);
    setUser(data.user as User);
    localStorage.setItem("driverHubAuth", JSON.stringify({ token: data.accessToken, user: data.user }));
  }

  function logout() {
    setToken("");
    setUser(null);
    setUsers([]);
    setDriverTasks([]);
    setTaskTemplates([]);
    setAssignedTasks([]);
    setReviewQueue([]);
    setDocuments([]);
    setTaskSubmissions({});
    localStorage.removeItem("driverHubAuth");
  }

  async function handleCreateTemplate() {
    if (!templateTitle || !templateDescription || requirementsDraft.length === 0) {
      setMessage("Template needs title, description, and at least one required document.");
      return;
    }

    await request("/task-templates", {
      method: "POST",
      body: JSON.stringify({
        title: templateTitle,
        description: templateDescription,
        requiredDocuments: requirementsDraft,
      }),
    });

    setTemplateTitle("");
    setTemplateDescription("");
    setRequirementTitle("");
    setRequirementDescription("");
    setRequirementType("document");
    setRequirementsDraft([]);
    setMessage("Task template created.");
    if (user) {
      await refreshData(token, user);
    }
  }

  async function handleAssignTask() {
    if (!assignTemplateId || !assignDriverId || !assignDueDate) {
      setMessage("Please choose template, driver, and due date.");
      return;
    }

    await request("/tasks", {
      method: "POST",
      body: JSON.stringify({
        templateId: assignTemplateId,
        driverId: assignDriverId,
        dueDate: assignDueDate,
      }),
    });

    setMessage("Task assigned to driver.");
    if (user) {
      await refreshData(token, user);
    }
  }

  async function handleSubmitTask(task: DriverTask) {
    const draft = taskSubmissions[task.id];
    const template = task.template;
    if (!template) {
      setMessage("Task template data missing.");
      return;
    }

    const submittedDocuments = template.requiredDocuments
      .map((required) => ({
        requirementId: required.id,
        fileName: draft?.files?.[required.id] ?? "",
        notes: "",
      }))
      .filter((doc) => doc.fileName.trim().length > 0);

    await request(`/tasks/${task.id}/submit`, {
      method: "POST",
      body: JSON.stringify({
        submittedDocuments,
        submissionNotes: draft?.notes ?? "",
      }),
    });

    setMessage("Task submitted for admin review.");
    if (user) {
      await refreshData(token, user);
    }
  }

  async function handleReviewTask(taskId: string, decision: "approved" | "resubmit_required") {
    await request(`/tasks/${taskId}/review`, {
      method: "PATCH",
      body: JSON.stringify({
        decision,
        feedback: reviewFeedbackDraft[taskId] ?? "",
      }),
    });

    setMessage(decision === "approved" ? "Task approved." : "Task sent back for resubmission.");
    if (user) {
      await refreshData(token, user);
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
        <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-1 text-2xl font-bold text-slate-900">Driver HUB</h1>
          <p className="mb-5 text-sm text-slate-600">Prototype login</p>
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <strong>Demo accounts</strong>
            <div>admin / admin123</div>
            <div>dispatcher / dispatcher123</div>
            <div>driver1 / driver123</div>
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
            <button className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800">
              Sign in
            </button>
          </form>
          {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
        </section>
      </main>
    );
  }

  const drivers = users.filter((candidate) => candidate.role === "driver");
  const pendingReviewCount = reviewQueue.length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-6">
      <section className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Driver HUB Dashboard</h1>
              <p className="text-sm text-slate-600">
                Logged in as {user.name} · <span className="capitalize">{user.role}</span>
              </p>
            </div>
            <div className="relative flex items-center gap-2">
              {user.role === "driver" ? (
                <Link
                  href="/profile"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Profile
                </Link>
              ) : null}
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
              <StatCard label="Open tasks" value={driverTasks.filter((task) => task.status !== "approved").length} tone="blue" />
              <StatCard label="Need resubmission" value={driverTasks.filter((task) => task.status === "resubmit_required").length} tone="amber" />
              <StatCard label="Profile documents" value={documents.length} tone="purple" />
            </div>

            <div className="grid gap-4 lg:grid-cols-1">
              <Card title="Assigned Tasks" subtitle="Upload required files and submit for review">
                <div className="space-y-3">
                  {driverTasks.length === 0 ? <Empty text="No tasks assigned yet." /> : null}
                  {driverTasks.map((task) => {
                    const template = task.template;
                    const isLocked = task.status === "submitted" || task.status === "approved";
                    return (
                      <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-slate-900">{template?.title ?? "Task"}</h3>
                          <StatusBadge value={task.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{template?.description}</p>
                        <p className="mt-1 text-xs text-slate-500">Due: {formatDate(task.dueDate)}</p>
                        {task.reviewFeedback ? (
                          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                            Admin feedback: {task.reviewFeedback}
                          </p>
                        ) : null}

                        <div className="mt-2 space-y-2">
                          {template?.requiredDocuments.map((required) => (
                            <label key={required.id} className="block text-xs text-slate-600">
                              {required.title} · {required.type}
                              <input
                                disabled={isLocked}
                                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100"
                                placeholder={required.description}
                                value={taskSubmissions[task.id]?.files?.[required.id] ?? ""}
                                onChange={(event) =>
                                  setTaskSubmissions((current) => ({
                                    ...current,
                                    [task.id]: {
                                      files: {
                                        ...(current[task.id]?.files ?? {}),
                                        [required.id]: event.target.value,
                                      },
                                      notes: current[task.id]?.notes ?? "",
                                    },
                                  }))
                                }
                              />
                            </label>
                          ))}

                          <textarea
                            disabled={isLocked}
                            className="w-full rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100"
                            placeholder="Submission notes (optional)"
                            value={taskSubmissions[task.id]?.notes ?? ""}
                            onChange={(event) =>
                              setTaskSubmissions((current) => ({
                                ...current,
                                [task.id]: {
                                  files: current[task.id]?.files ?? {},
                                  notes: event.target.value,
                                },
                              }))
                            }
                          />

                          {!isLocked ? (
                            <button
                              onClick={() => handleSubmitTask(task)}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
                            >
                              Submit Task
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {(user.role === "admin" || user.role === "dispatcher") ? (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Total users" value={users.length} tone="blue" />
              <StatCard label="Templates" value={taskTemplates.length} tone="purple" />
              <StatCard label="Assigned tasks" value={assignedTasks.length} tone="green" />
              <StatCard label="Waiting admin review" value={pendingReviewCount} tone="amber" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="User List" subtitle="Drivers available for task assignment">
                <SimpleTable
                  columns={["Name", "Username", "Role", "ID"]}
                  rows={users.map((u) => [u.name, u.username, <RolePill key={u.id} role={u.role} />, u.id])}
                  emptyText="No users available."
                />
              </Card>

              <Card title="Assign Task" subtitle="Admin and dispatcher can send templates to drivers">
                <div className="space-y-2">
                  <select
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                    value={assignTemplateId}
                    onChange={(e) => setAssignTemplateId(e.target.value)}
                  >
                    <option value="">Select template</option>
                    {taskTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                    value={assignDriverId}
                    onChange={(e) => setAssignDriverId(e.target.value)}
                  >
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} ({driver.id})
                      </option>
                    ))}
                  </select>

                  <input
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    placeholder="Due date (ISO format)"
                  />

                  <button
                    onClick={handleAssignTask}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
                  >
                    Send Task To Driver
                  </button>
                </div>
              </Card>
            </div>

            <Card title="Task Templates" subtitle="Task designs and required document checklist">
              <SimpleTable
                columns={["Template", "Description", "Required Docs"]}
                rows={taskTemplates.map((template) => [
                  template.title,
                  template.description,
                  template.requiredDocuments.map((doc) => `${doc.title} (${doc.type})`).join(", "),
                ])}
                emptyText="No task templates created yet."
              />
            </Card>

            {user.role === "admin" ? (
              <Card title="Create Task Template" subtitle="Define task title + required document attachments">
                <div className="grid gap-2 lg:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-300 p-2 text-sm"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    placeholder="Template title"
                  />
                  <input
                    className="rounded-lg border border-slate-300 p-2 text-sm"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Template description"
                  />
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-700">Add required document</p>
                  <div className="grid gap-2 lg:grid-cols-3">
                    <input
                      className="rounded-lg border border-slate-300 p-2 text-sm"
                      value={requirementTitle}
                      onChange={(e) => setRequirementTitle(e.target.value)}
                      placeholder="Title (e.g. Tacho Log)"
                    />
                    <input
                      className="rounded-lg border border-slate-300 p-2 text-sm"
                      value={requirementType}
                      onChange={(e) => setRequirementType(e.target.value)}
                      placeholder="Type (log/photo/document)"
                    />
                    <input
                      className="rounded-lg border border-slate-300 p-2 text-sm"
                      value={requirementDescription}
                      onChange={(e) => setRequirementDescription(e.target.value)}
                      placeholder="Description"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!requirementTitle || !requirementDescription || !requirementType) {
                        setMessage("Requirement needs title, type, and description.");
                        return;
                      }
                      setRequirementsDraft((current) => [
                        ...current,
                        {
                          title: requirementTitle,
                          type: requirementType,
                          description: requirementDescription,
                        },
                      ]);
                      setRequirementTitle("");
                      setRequirementDescription("");
                      setRequirementType("document");
                    }}
                    className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-white"
                  >
                    Add Requirement
                  </button>

                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {requirementsDraft.length === 0 ? <Empty text="No requirements added yet." /> : null}
                    {requirementsDraft.map((req, index) => (
                      <div key={`${req.title}-${index}`} className="rounded border border-slate-200 bg-white px-2 py-1">
                        {req.title} · {req.type} · {req.description}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateTemplate}
                  className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
                >
                  Create Template
                </button>
              </Card>
            ) : null}

            {user.role === "admin" ? (
              <Card title="Admin Review Queue" subtitle="Submitted tasks can be approved or returned for resubmission">
                <div className="space-y-3">
                  {reviewQueue.length === 0 ? <Empty text="No submitted tasks waiting for review." /> : null}
                  {reviewQueue.map((task) => (
                    <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">{task.template?.title}</h3>
                        <StatusBadge value={task.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-700">Driver: {task.driver?.name ?? task.driverId}</p>
                      <p className="mt-1 text-sm text-slate-700">Submitted files:</p>
                      <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                        {task.submittedDocuments.map((doc: { requirementId: string; fileName: string }) => (
                          <li key={`${task.id}-${doc.requirementId}`}>{doc.fileName}</li>
                        ))}
                      </ul>

                      <textarea
                        className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm"
                        placeholder="Feedback for driver (required for resubmission)"
                        value={reviewFeedbackDraft[task.id] ?? ""}
                        onChange={(event) =>
                          setReviewFeedbackDraft((current) => ({
                            ...current,
                            [task.id]: event.target.value,
                          }))
                        }
                      />

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleReviewTask(task.id, "approved")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReviewTask(task.id, "resubmit_required")}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
                        >
                          Request Resubmission
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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

function StatusBadge({ value }: { value: string }) {
  const text = value.toLowerCase();
  const styles =
    text === "approved"
      ? "bg-emerald-100 text-emerald-700"
      : text === "submitted"
        ? "bg-blue-100 text-blue-700"
        : text === "resubmit_required"
          ? "bg-amber-100 text-amber-700"
          : "bg-slate-100 text-slate-700";

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
