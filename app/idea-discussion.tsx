"use client";

import { FormEvent, useEffect, useState } from "react";
import { getIdeaOwnerKey } from "../lib/client-identity";

type IdeaSummary = {
  id: number;
  title: string;
  description: string;
  feasibility: number;
  potential: number;
  urgency: number;
  urgencyBasis: string;
  originalTitle?: string;
  originalDescription?: string;
  displayedLanguage?: string;
  sourceLanguage?: string;
};

type Comment = { id: number; body: string; language_code: string; created_at: string };

export default function IdeaDiscussion({ idea, commentsEnabled, onClose }: { idea: IdeaSummary; commentsEnabled: boolean; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showReviewConfirmation, setShowReviewConfirmation] = useState(false);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const hasTranslation = Boolean(idea.originalTitle && idea.originalTitle !== idea.title);
  const lowFeasibility = idea.feasibility <= 1;
  const lowPotential = idea.potential <= 2;

  async function submitAnalysisReview() {
    if (!reviewAcknowledged) return;
    if (!commentsEnabled) {
      setReviewMessage("Demonstracione ideje ne mogu biti poslate moderatorima.");
      setShowReviewConfirmation(false);
      return;
    }
    setReviewSubmitting(true);
    setReviewMessage("");
    try {
      const response = await fetch("/api/analysis-reviews", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idea-owner-key": getIdeaOwnerKey() },
        body: JSON.stringify({ ideaId: idea.id, acknowledged: true }),
      });
      const data = await response.json() as { error?: string };
      if (response.ok) setReviewMessage("Zahtev je poslat moderatorima.");
      else if (data.error === "duplicate_review") setReviewMessage("Ova procena je već poslata na proveru.");
      else if (data.error === "review_rate_limited") setReviewMessage("Dostignut je limit zahteva za proveru. Sačekaj pre novog zahteva.");
      else setReviewMessage("Zahtev trenutno nije moguće poslati.");
      setShowReviewConfirmation(false);
    } catch {
      setReviewMessage("Zahtev trenutno nije moguće poslati.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function loadComments() {
    setLoading(true);
    try {
      const response = await fetch(`/api/comments?ideaId=${idea.id}`, { cache: "no-store" });
      const data = await response.json() as { comments?: Comment[] };
      setComments(data.comments ?? []);
    } catch {
      setMessage("Komentari trenutno nisu dostupni.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!commentsEnabled) return;
    let active = true;
    fetch(`/api/comments?ideaId=${idea.id}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ comments?: Comment[] }>)
      .then((data) => { if (active) setComments(data.comments ?? []); })
      .catch(() => { if (active) setMessage("Komentari trenutno nisu dostupni."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [commentsEnabled, idea.id]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const body = new FormData(form).get("comment")?.toString().trim() ?? "";
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-idea-owner-key": getIdeaOwnerKey() },
      body: JSON.stringify({ ideaId: idea.id, body, languageCode: document.documentElement.lang }),
    });
    const data = await response.json() as { error?: string; explanation?: string; status?: string };
    if (!response.ok) {
      setMessage(data.explanation ?? (data.error === "rate_limited" ? "Previše komentara za kratko vreme. Pokušaj ponovo za deset minuta." : "Komentar nije moguće poslati."));
      return;
    }
    form.reset();
    setMessage(data.status === "pending" ? "Komentar je poslat na proveru." : "Komentar je objavljen.");
    if (data.status === "approved") await loadComments();
  }

  return <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal discussionModal" role="dialog" aria-modal="true" aria-labelledby="discussion-title">
      <button className="modalClose" onClick={onClose} aria-label="Zatvori">×</button>
      <span className="modalKicker">Ideja i diskusija</span>
      <h2 id="discussion-title">{idea.title}</h2>
      <p className="translatedText">{idea.description}</p>
      <div className="urgencySummary"><span>Hitnost</span><b>{idea.urgency.toFixed(2)} / 10</b><p>{idea.urgencyBasis}</p></div>
      {hasTranslation && <details className="originalText"><summary>Prikaži original · {idea.sourceLanguage}</summary><div data-no-transliterate><h3>{idea.originalTitle}</h3><p>{idea.originalDescription}</p></div></details>}
      {(lowFeasibility || lowPotential) && <aside className="analysisReview">
        <span>!</span><div><b>Provera procene</b>
          {lowFeasibility && <p>Nažalost, trenutno ne verujemo da je ova ideja izvodljiva u Srbiji.</p>}
          {lowPotential && <p>Nažalost, trenutno procenjujemo da ova ideja ima veoma nizak potencijal.</p>}
          <p>Misliš da je procena pogrešna? Možeš zatražiti proveru moderatora.</p>
          {!showReviewConfirmation && !reviewMessage && <button type="button" onClick={() => setShowReviewConfirmation(true)}>Zatraži proveru</button>}
          {showReviewConfirmation && <div className="reviewConfirmation">
            <p><strong>Upozorenje:</strong> zahtev će pregledati moderatori. Namerno slanje ponovljenih ili neosnovanih zahteva smatra se zloupotrebom i može dovesti do ograničenja ili zabrane naloga.</p>
            <label><input type="checkbox" checked={reviewAcknowledged} onChange={(event) => setReviewAcknowledged(event.target.checked)} /> Razumem upozorenje i ipak želim da pošaljem zahtev.</label>
            <div><button type="button" onClick={() => { setShowReviewConfirmation(false); setReviewAcknowledged(false); }}>Odustani</button><button type="button" disabled={!reviewAcknowledged || reviewSubmitting} onClick={submitAnalysisReview}>{reviewSubmitting ? "Slanje…" : "Pošalji moderatorima"}</button></div>
          </div>}
          {reviewMessage && <p className="reviewMessage" role="status">{reviewMessage}</p>}
        </div>
      </aside>}
      <div className="commentsHeader"><h3>Komentari</h3><span>{comments.length}</span></div>
      <div className="commentList" aria-live="polite">
        {!commentsEnabled ? <p>Komentari se otvaraju kada ideja završi obradu i bude objavljena.</p> : loading ? <p>Učitavanje komentara…</p> : comments.length ? comments.map((comment) => <article key={comment.id}><p>{comment.body}</p><small>{comment.language_code} · {new Date(comment.created_at).toLocaleDateString()}</small></article>) : <p>Još nema komentara. Dodaj prvi konstruktivan osvrt.</p>}
      </div>
      {commentsEnabled && <form className="commentForm" onSubmit={submitComment}>
        <label htmlFor="comment-body">Tvoj komentar</label>
        <textarea id="comment-body" name="comment" required minLength={3} maxLength={1500} placeholder="Dodaj argument, iskustvo ili predlog za poboljšanje…" />
        <div><small>Komentari podležu istim pravilima bezbednosti kao ideje.</small><button className="primaryButton">Objavi komentar <span>↗</span></button></div>
        {message && <p className="formMessage" role="status">{message}</p>}
      </form>}
    </section>
  </div>;
}
