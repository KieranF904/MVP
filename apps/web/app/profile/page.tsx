"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Role = "admin" | "dispatcher" | "driver";

type User = {
  id: string;
  username: string;
  name: string;
  role: Role;
};

type DriverDocument = {
  id: string;
  type: string;
  fileName: string;
  status: "pending" | "approved" | "rejected";
  uploadedAt?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

export default function ProfilePage() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [licenseFile, setLicenseFile] = useState("");
  const [licenseNotes, setLicenseNotes] = useState("");
  const [message, setMessage] = useState("");

  const authHeader = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  useEffect(() => {
    const saved = localStorage.getItem("driverHubAuth");
    if (!saved) return;

    const parsed = JSON.parse(saved) as { token: string; user: User };
    setToken(parsed.token);
    setUser(parsed.user);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadProfile(token);
  }, [token]);

  async function loadProfile(activeToken: string) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeToken}`,
    };

    const [meRes, docsRes] = await Promise.all([
      fetch(`${API_URL}/me`, { headers }),
      fetch(`${API_URL}/documents`, { headers }),
    ]);

    if (meRes.ok) {
      const me = (await meRes.json()) as User;
      setUser(me);
    }

    if (docsRes.ok) {
      const docs = (await docsRes.json()) as DriverDocument[];
      setDocuments(docs.filter((doc) => doc.type === "driver_license"));
    }
  }

  async function uploadLicense() {
    if (!licenseFile.trim()) {
      setMessage("Please enter a file name for your license.");
      return;
    }

    const response = await fetch(`${API_URL}/documents`, {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        type: "driver_license",
        fileName: licenseFile,
        notes: licenseNotes || undefined,
      }),
    });

    if (!response.ok) {
      setMessage("Could not upload license.");
      return;
    }

    setLicenseFile("");
    setLicenseNotes("");
    setMessage("License uploaded.");
    await loadProfile(token);
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
          <p className="mt-2 text-sm text-slate-600">You are not logged in.</p>
          <Link href="/" className="mt-4 inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white">
            Back to Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Driver Profile</h1>
            <p className="text-sm text-slate-600">Username and name are managed by admin.</p>
          </div>
          <Link href="/" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Back to Dashboard
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Account Details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Username</p>
              <p className="text-sm font-semibold text-slate-900">{user.username}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Name</p>
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
            </div>
          </div>
        </section>

        {user.role === "driver" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Driver License</h2>
            <p className="text-sm text-slate-600">Upload your driver license for admin review.</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-lg border border-slate-300 p-2 text-sm"
                placeholder="License file name"
                value={licenseFile}
                onChange={(event) => setLicenseFile(event.target.value)}
              />
              <input
                className="rounded-lg border border-slate-300 p-2 text-sm"
                placeholder="Optional note"
                value={licenseNotes}
                onChange={(event) => setLicenseNotes(event.target.value)}
              />
            </div>

            <button
              onClick={uploadLicense}
              className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            >
              Upload License
            </button>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.length === 0 ? (
                    <tr>
                      <td className="px-3 py-2 text-slate-500" colSpan={3}>
                        No license uploads yet.
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="px-3 py-2 text-slate-700">{doc.fileName}</td>
                        <td className="px-3 py-2 text-slate-700">{doc.status}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {message ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</p>
        ) : null}
      </section>
    </main>
  );
}
