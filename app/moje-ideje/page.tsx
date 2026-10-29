"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getIdeaOwnerKey } from "../../lib/client-identity";

type MyIdea = {
  id: number; title: string; problem: string; visibility: "public" | "restricted";
  idea_type: "reform" | "platform";
  moderation_status: "pending" | "approved" | "rejected"; ministry: string | null;
  processing_status: "queued" | "processing" | "completed" | "failed";
  feasibility: number | null; feasibility_basis: string | null; potential: number | null;
  urgency: number | null; urgency_basis: string | null; acceptability: number | null;
  queue_position: number | null; created_at: string;
};

const statusText = {
  queued: ["U redu za obradu", "Predlog je bezbedno sačuvan i čeka Llama analizu."],
  processing: ["Analiza je u toku", "Llama trenutno predlaže oblasti, oznake i početne ocene."],
  completed: ["Obrada završena", "Automatska analiza je završena; predlog čeka ili je prošao moderaciju."],
  failed: ["Potrebna nova obrada", "Predlog je sačuvan. Sistem će ponoviti analizu ili ga preuzeti moderator."],
} as const;

const formatScore = (value: number | null) => value === null ? "—" : Number(value).toFixed(2);

export default function MyIdeasPage() {
  const [ideas, setIdeas] = useState<MyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadIdeas = useCallback(async () => {
    try {
      const response = await fetch("/api/my-ideas", { headers: { "x-idea-owner-key": getIdeaOwnerKey() }, cache: "no-store" });
      if (!response.ok) throw new Error("load_failed");
      const result = await response.json() as { ideas: MyIdea[] };
      setIdeas(result.ideas); setError("");
    } catch { setError("Status trenutno nije moguće učitati. Tvoje ideje su i dalje sačuvane."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    queueMicrotask(loadIdeas);
    const timer = window.setInterval(loadIdeas, 15_000);
    return () => window.clearInterval(timer);
  }, [loadIdeas]);

  return <main className="myIdeasPage">
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Glas za reforme — početna"><span className="brandMark">G</span><span>Glas za <b>reforme</b></span></Link>
      <nav aria-label="Glavna navigacija"><Link href="/#ideje">Ideje</Link><Link href="/#kako-radi">Kako radi</Link><Link className="active" href="/moje-ideje">Moje ideje</Link></nav>
      <Link className="primaryButton small" href="/#predlozi">Nova ideja <span>↗</span></Link>
    </header>
    <section className="myIdeasHero">
      <div><span className="eyebrow"><i /> Lični pregled</span><h1>Moje ideje</h1><p>Ovde ostaju svi predlozi poslati sa ovog uređaja, čak i kada Llama ima red za obradu.</p></div>
      <button className="outlineButton" onClick={loadIdeas}>Osveži status <span>↻</span></button>
    </section>
    <section className="myIdeasContent">
      <div className="queueExplainer"><span>✦</span><div><b>Ideja ne može da se izgubi u redu.</b><p>Čuvamo je pre početka analize. Status se automatski osvežava na svakih 15 sekundi, a pozicija se menja kako obrada napreduje.</p></div></div>
      {error && <p className="formError" role="alert">{error}</p>}
      {loading ? <div className="emptyIdeas">Učitavanje tvojih ideja…</div> : ideas.length === 0 ? <div className="emptyIdeas"><b>Još nema poslatih ideja.</b><p>Možeš sačuvati nacrt na početnoj strani ili odmah poslati prvi predlog.</p><Link className="primaryButton" href="/#predlozi">Predloži reformu <span>↗</span></Link></div> : <div className="myIdeasList">
        {ideas.map((idea) => {
          const status = statusText[idea.processing_status];
          const lowFeasibility = idea.feasibility !== null && idea.feasibility <= 1;
          const lowPotential = idea.potential !== null && idea.potential <= 2;
          return <article className="myIdeaCard" key={idea.id}>
            <div className="myIdeaMeta"><span className={`queueStatus ${idea.processing_status}`}>{status[0]}</span><time>{new Date(idea.created_at).toLocaleDateString("sr-RS")}</time></div>
            <h2>{idea.title}</h2><p>{idea.problem}</p>
            {(lowFeasibility || lowPotential) && <aside className="myIdeaWarning">
              <div><b>Ova ideja nije javno prikazana</b>
                {lowFeasibility && <p>Nažalost, trenutno ne verujemo da je ova ideja izvodljiva u Srbiji.</p>}
                {lowPotential && <p>Nažalost, trenutno procenjujemo da ova ideja ima veoma nizak potencijal.</p>}
                <p>Vidljiva je samo u odeljku Moje ideje dok moderator ne potvrdi ili ispravi procenu.</p>
              </div>
              <dl className="myIdeaScores">
                <div><dt>Izvodljivost</dt><dd>{formatScore(idea.feasibility)}</dd></div>
                <div><dt>Potencijal</dt><dd>{formatScore(idea.potential)}</dd></div>
                <div><dt>Hitnost</dt><dd>{formatScore(idea.urgency)}</dd></div>
                <div><dt>Podrška u Srbiji</dt><dd>{formatScore(idea.acceptability)}</dd></div>
              </dl>
            </aside>}
            <div className="queueProgress"><i className={idea.processing_status} /><div><b>{idea.queue_position ? `Pozicija u redu: ${idea.queue_position}` : status[0]}</b><span>{status[1]}</span></div></div>
            <div className="myIdeaFooter"><span>{idea.idea_type === "platform" ? "Poboljšanje platforme" : idea.visibility === "restricted" ? "Ograničena provera" : "Reforma države"}</span><span>{idea.ministry || "Oblast još nije potvrđena"}</span></div>
          </article>;
        })}
      </div>}
      <p className="deviceNotice">Ovaj privremeni pregled je vezan za trenutni pregledač. Kada OAuth prijava bude uključena, ideje će biti povezane sa nalogom i dostupne na svim uređajima.</p>
    </section>
  </main>;
}
