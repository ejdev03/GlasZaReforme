"use client";

import { useState } from "react";
import Link from "next/link";

type ModeratorReport = {
  id: number;
  report_type: "corruption" | "sensitive";
  title: string;
  problem: string;
  solution: string;
  source_language: string;
  safety_reason: string | null;
  moderation_status: "pending" | "reviewing" | "referred" | "closed";
  created_at: string;
};

const statusLabels: Record<ModeratorReport["moderation_status"], string> = {
  pending: "Čeka pregled",
  reviewing: "U pregledu",
  referred: "Prosleđeno nadležnima",
  closed: "Zatvoreno",
};

export default function ModerationPage() {
  const [accessKey, setAccessKey] = useState("");
  const [reports, setReports] = useState<ModeratorReport[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadReports(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/moderator/reports", { headers: { authorization: `Bearer ${accessKey}` }, cache: "no-store" });
      if (!response.ok) throw new Error("unauthorized");
      const data = await response.json() as { reports: ModeratorReport[] };
      setReports(data.reports);
    } catch {
      setReports([]); setError("Pristup nije odobren ili moderatorski kanal još nije podešen.");
    } finally { setLoading(false); }
  }

  const groups = [
    { type: "corruption" as const, title: "Prijave korupcije", description: "Anonimne prijave sumnje na mito, zloupotrebu položaja ili nameštene postupke." },
    { type: "sensitive" as const, title: "Osetljive prijave", description: "Moguće poverljivi, bezbednosni ili lični podaci koji nikada ne ulaze u javni tok ideja." },
  ];

  return <main className="moderationPage">
    <header className="topbar"><Link className="brand" href="/"><span className="brandMark">G</span><span>Glas za <b>reforme</b></span></Link><Link href="/">Povratak na platformu</Link></header>
    <section className="moderationHero"><span className="eyebrow"><i /> Ograničen pristup</span><h1>Moderatorske prijave</h1><p>Ovaj odeljak nije deo javnog toka. Prijave ne sadrže ključ uređaja, IP oznaku, nalog niti drugi identifikator podnosioca.</p></section>
    <section className="moderationContent">
      <form className="moderatorAccess" onSubmit={loadReports}><label>Moderatorski pristup<input type="password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} autoComplete="off" required /></label><button className="primaryButton" disabled={loading}>{loading ? "Provera…" : "Otvori prijave"}</button></form>
      {error && <p className="formError" role="alert">{error}</p>}
      {reports.length > 0 && <div className="moderatorGroups">{groups.map((group) => <section key={group.type}><header><h2>{group.title}</h2><p>{group.description}</p><b>{reports.filter((report) => report.report_type === group.type).length}</b></header><div>{reports.filter((report) => report.report_type === group.type).map((report) => <article key={report.id}><div><span>{statusLabels[report.moderation_status]}</span><time>{new Date(report.created_at).toLocaleString("sr-RS")}</time></div><h3>{report.title}</h3><p><b>Problem</b>{report.problem}</p><p><b>Predloženo rešenje</b>{report.solution}</p><small>{report.source_language}{report.safety_reason ? ` · ${report.safety_reason}` : ""}</small></article>)}</div></section>)}</div>}
    </section>
  </main>;
}
