"use client";

import { useEffect, useMemo, useState } from "react";
import { getIdeaOwnerKey } from "../lib/client-identity";
import IdeaDiscussion from "./idea-discussion";

type IdeaCard = { id: number; ministry: string; title: string; description: string; tags: string[]; score: number; votes: number; feasibility: number; potential: number; urgency: number; urgencyBasis: string; publicSupport: number; confidence: string; hot: boolean; persisted: boolean; communityCount?: number; communityFeasibility?: number; communityPotential?: number; communityUrgency?: number; communitySupport?: number; aiFeasibility?: number; aiPotential?: number; aiUrgency?: number; aiSupport?: number; createdAt?: string; originalTitle?: string; originalDescription?: string; sourceLanguage?: string; displayedLanguage?: string };
type IdeaSort = "popular" | "newest" | "feasible" | "urgent";
type CategoryRatings = { feasibility: number; potential: number; urgency: number; support: number };
type RatingResponse = { rating_count: number; feasibility: number; potential: number; urgency: number; acceptability: number; community_feasibility: number; community_potential: number; community_urgency: number; community_support: number };

const demoIdeas: IdeaCard[] = [
  { id: 2, ministry: "Prosveta", title: "Otvoreni udžbenici za osnovne škole", description: "Javno finansirani digitalni udžbenici, dostupni besplatno svim učenicima i nastavnicima.", tags: ["Obrazovanje", "Otvoreni podaci"], score: 8.4, votes: 1932, feasibility: 8, potential: 9, urgency: 6, urgencyBasis: "Svaka školska generacija oseća trošak odlaganja, ali promena nije vanredna mera.", publicSupport: 8, confidence: "srednja", hot: false, persisted: false },
  { id: 3, ministry: "Zdravstvo", title: "Transparentne liste čekanja u zdravstvu", description: "Anonimizovan javni uvid u dužinu čekanja po ustanovi, proceduri i regionu.", tags: ["Zdravstvo", "Transparentnost"], score: 8.1, votes: 1654, feasibility: 7, potential: 9, urgency: 9, urgencyBasis: "Odlaganje može produžiti čekanje na lečenje i neposredno uticati na zdravlje pacijenata.", publicSupport: 8, confidence: "visoka", hot: false, persisted: false },
  { id: 4, ministry: "Prosveta", title: "Personalizovano obrazovanje uz AI mentore", description: "AI bi prilagođavao tempo, sadržaj i kriterijume napretka svakom učeniku, dok bi nastavnici imali više vremena za mentorski rad umesto jednosmernih predavanja.", tags: ["Obrazovanje", "Veštačka inteligencija", "Nastavnici"], score: 8.3, votes: 3214, feasibility: 7, potential: 10, urgency: 6, urgencyBasis: "Potencijal je visok, ali bezbedan pilot i obuka nastavnika važniji su od brzine.", publicSupport: 8, confidence: "srednja", hot: true, persisted: false },
  { id: 5, ministry: "Privreda i finansije", title: "Pametna valuta sa automatskim porezima i namenskim računima", description: "Digitalni platni sistem bi mogao automatski da izdvaja poreze i ugovorene obaveze prema dobavljačima, kako veliki trgovinski lanci ne bi koristili novac koji duguju malim firmama.", tags: ["Finansije", "Porezi", "Zaštita dobavljača"], score: 7.0, votes: 1876, feasibility: 5, potential: 9, urgency: 8, urgencyBasis: "Kašnjenje plaćanja dobavljačima stvara tekuću štetu malim firmama i zaposlenima.", publicSupport: 7, confidence: "srednja", hot: false, persisted: false },
  { id: 6, ministry: "Privreda i finansije", title: "Investicioni fond dostupan malim firmama i građanima", description: "AI bi radio početno razvrstavanje poslovnih planova, a privatni građani bi kroz jasna pravila lakše ulagali u proverene male firme i učestvovali u rastu domaće privrede.", tags: ["Mala preduzeća", "Investicije", "Veštačka inteligencija"], score: 8.3, votes: 2431, feasibility: 8, potential: 9, urgency: 5, urgencyBasis: "Korist može biti velika, ali vreme primene je fleksibilno i zahteva pažljivu regulaciju.", publicSupport: 8, confidence: "srednja", hot: false, persisted: false },
  { id: 7, ministry: "Nauka i tehnološki razvoj", title: "Srpska kolonija na Mesecu", description: "Srbija bi samostalno finansirala trajno naselje na Mesecu. Ideja može podstaći naučnu ambiciju, ali je sa sadašnjim budžetom, infrastrukturom i kapacitetima praktično neizvodljiva.", tags: ["Svemir", "Nauka", "Dugoročna vizija"], score: 2.0, votes: 419, feasibility: 0, potential: 4, urgency: 2, urgencyBasis: "Dugoročna ambicija bez neposredne štete ako se odloži.", publicSupport: 2, confidence: "visoka", hot: false, persisted: false },
  { id: 8, ministry: "Rad i privreda", title: "Zabrana ugovornih klauzula koje prisvajaju nepovezanu intelektualnu svojinu", description: "Poslodavac bi smeo da polaže prava samo na rezultate nastale u okviru ugovorenog posla, poslovne oblasti firme ili uz značajnu upotrebu njenih poverljivih podataka i resursa. Programer igara mora ostati slobodan da nezavisno napravi bankarsku aplikaciju. Klauzule koje prisvajaju sve sadašnje i buduće ideje, uključujući nepovezan rad van radnog vremena, bile bi ništave.", tags: ["Radna prava", "Intelektualna svojina", "Sloboda stvaranja"], score: 8.7, votes: 2768, feasibility: 8, potential: 9, urgency: 6, urgencyBasis: "Problem traje i ograničava radnike, ali nije vanredna mera koja zahteva trenutno sprovođenje.", publicSupport: 9, confidence: "visoka", hot: true, persisted: false },
];

export default function Home() {
  const [draft, setDraft] = useState({ title: "", problem: "", solution: "", ideaType: "reform" as "reform" | "platform" });
  const [draftMessage, setDraftMessage] = useState("");
  const [displayedIdeas, setDisplayedIdeas] = useState<IdeaCard[]>(demoIdeas);
  const [ideaQuery, setIdeaQuery] = useState("");
  const [ideaSort, setIdeaSort] = useState<IdeaSort>("popular");
  const [ideaMinistry, setIdeaMinistry] = useState("all");
  const [showAllIdeas, setShowAllIdeas] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const [discussionIdea, setDiscussionIdea] = useState<IdeaCard | null>(null);
  const [ratingIdea, setRatingIdea] = useState<IdeaCard | null>(null);
  const [ratingDraft, setRatingDraft] = useState<CategoryRatings>({ feasibility: 5, potential: 5, urgency: 5, support: 5 });
  const [myRatings, setMyRatings] = useState<Record<number, CategoryRatings>>({});
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [voted, setVoted] = useState<number[]>([]);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedVisibility, setSubmittedVisibility] = useState<"public" | "restricted" | null>(null);
  const [submittedQueuePosition, setSubmittedQueuePosition] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  function openRating(idea: IdeaCard) {
    setRatingIdea(idea);
    setRatingError("");
    setRatingDraft(myRatings[idea.id] ?? {
      feasibility: Math.round(idea.feasibility), potential: Math.round(idea.potential),
      urgency: Math.round(idea.urgency), support: Math.round(idea.publicSupport),
    });
  }

  async function submitRating(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ratingIdea) return;
    setRatingSubmitting(true);
    setRatingError("");
    try {
      let community: RatingResponse = { rating_count: 1, feasibility: ratingDraft.feasibility, potential: ratingDraft.potential,
        urgency: ratingDraft.urgency, acceptability: ratingDraft.support, community_feasibility: ratingDraft.feasibility,
        community_potential: ratingDraft.potential, community_urgency: ratingDraft.urgency, community_support: ratingDraft.support };
      if (ratingIdea.persisted) {
        const response = await fetch("/api/votes", {
          method: "POST",
          headers: { "content-type": "application/json", "x-idea-owner-key": getIdeaOwnerKey() },
          body: JSON.stringify({ ideaId: ratingIdea.id, ratings: ratingDraft }),
        });
        if (!response.ok) throw new Error("vote_failed");
        community = await response.json() as RatingResponse;
      }
      setDisplayedIdeas((current) => current.map((idea) => {
        if (idea.id !== ratingIdea.id) return idea;
        const feasibility = Number(community.feasibility ?? ratingDraft.feasibility);
        const potential = Number(community.potential ?? ratingDraft.potential);
        const urgency = Number(community.urgency ?? ratingDraft.urgency);
        const publicSupport = Number(community.acceptability ?? ratingDraft.support);
        return { ...idea, feasibility, potential, urgency, publicSupport, score: (feasibility + potential + publicSupport) / 3,
          communityCount: Number(community.rating_count ?? 1), communityFeasibility: Number(community.community_feasibility ?? ratingDraft.feasibility),
          communityPotential: Number(community.community_potential ?? ratingDraft.potential), communityUrgency: Number(community.community_urgency ?? ratingDraft.urgency),
          communitySupport: Number(community.community_support ?? ratingDraft.support) };
      }));
      setMyRatings((current) => ({ ...current, [ratingIdea.id]: ratingDraft }));
      setVoted((current) => current.includes(ratingIdea.id) ? current : [...current, ratingIdea.id]);
      setRatingIdea(null);
    } catch {
      setRatingError("Ocene trenutno nije moguće sačuvati. Pokušaj ponovo.");
    } finally {
      setRatingSubmitting(false);
    }
  }

  const publicIdeas = useMemo(() => displayedIdeas.filter((idea) => idea.feasibility > 1 && idea.potential > 2), [displayedIdeas]);
  const ministries = useMemo(() => [...new Set(publicIdeas.map((idea) => idea.ministry))].sort((a, b) => a.localeCompare(b, "sr")), [publicIdeas]);
  const sectorSummaries = useMemo(() => ministries.map((ministry) => ({ ministry, count: publicIdeas.filter((idea) => idea.ministry === ministry).length })), [publicIdeas, ministries]);
  const filteredIdeas = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("sr");
    const query = normalize(ideaQuery.trim());
    return publicIdeas
      .filter((idea) => ideaMinistry === "all" || idea.ministry === ideaMinistry)
      .filter((idea) => !query || normalize([idea.title, idea.description, idea.ministry, ...idea.tags].join(" ")).includes(query))
      .sort((a, b) => {
        if (ideaSort === "feasible") return b.feasibility - a.feasibility || b.score - a.score || b.votes - a.votes;
        if (ideaSort === "urgent") return b.urgency - a.urgency || b.potential - a.potential || b.votes - a.votes;
        if (ideaSort === "newest") return (Date.parse(b.createdAt ?? "") || b.id) - (Date.parse(a.createdAt ?? "") || a.id);
        return b.votes - a.votes || b.score - a.score;
      });
  }, [publicIdeas, ideaMinistry, ideaQuery, ideaSort]);
  const visibleIdeas = showAllIdeas ? filteredIdeas : filteredIdeas.slice(0, 8);

  function chooseMinistry(ministry: string) {
    setIdeaMinistry(ministry);
    setShowAllIdeas(true);
    window.setTimeout(() => document.querySelector("#ideje")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function clearIdeaFilters() {
    setIdeaQuery("");
    setIdeaMinistry("all");
    setIdeaSort("popular");
    setShowAllIdeas(false);
  }

  useEffect(() => {
    getIdeaOwnerKey();
    const stored = window.localStorage.getItem("glas-za-reforme-draft");
    if (stored) {
      try {
        const restored = JSON.parse(stored);
        queueMicrotask(() => setDraft({ title: "", problem: "", solution: "", ideaType: "reform", ...restored }));
      } catch { window.localStorage.removeItem("glas-za-reforme-draft"); }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get("sort");
    queueMicrotask(() => {
      setIdeaQuery(params.get("q") ?? "");
      setIdeaMinistry(params.get("oblast") ?? "all");
    if (sort === "newest" || sort === "feasible" || sort === "urgent" || sort === "popular") setIdeaSort(sort);
      if (params.has("q") || params.has("oblast") || params.has("sort")) setShowAllIdeas(true);
      setFiltersReady(true);
    });
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    const url = new URL(window.location.href);
    if (ideaQuery.trim()) url.searchParams.set("q", ideaQuery.trim()); else url.searchParams.delete("q");
    if (ideaMinistry !== "all") url.searchParams.set("oblast", ideaMinistry); else url.searchParams.delete("oblast");
    if (ideaSort !== "popular") url.searchParams.set("sort", ideaSort); else url.searchParams.delete("sort");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [filtersReady, ideaMinistry, ideaQuery, ideaSort]);

  useEffect(() => {
    async function loadPublishedIdeas() {
      const locale = document.documentElement.lang || "sr-Latn";
      try {
        const response = await fetch(`/api/ideas?lang=${encodeURIComponent(locale)}`, { cache: "no-store" });
        const data = await response.json() as { ideas?: Array<Record<string, unknown>> };
        if (!data.ideas?.length) return;
        const parseTags = (value: unknown) => Array.isArray(value) ? value.map(String) : typeof value === "string" ? JSON.parse(value) as string[] : [];
        setDisplayedIdeas(data.ideas.map((idea) => {
          const feasibility = Number(idea.feasibility ?? 0);
          const potential = Number(idea.potential ?? 0);
          const urgency = Number(idea.urgency ?? 5);
          const publicSupport = Number(idea.acceptability ?? 0);
          return { id: Number(idea.id), ministry: String(idea.ministry ?? "Oblast u obradi"), title: String(idea.title), description: String(idea.problem), tags: parseTags(idea.tags), score: (feasibility + potential + publicSupport) / 3, votes: Number(idea.votes ?? 0), feasibility, potential, urgency, urgencyBasis: String(idea.urgency_basis ?? "Nije utvrđena neposredna šteta od umerenog odlaganja."), publicSupport, confidence: Number(idea.acceptance_confidence ?? 0) >= .75 ? "visoka" : "srednja", hot: false, persisted: true, communityCount: Number(idea.community_rating_count ?? 0), communityFeasibility: Number(idea.community_feasibility ?? 0), communityPotential: Number(idea.community_potential ?? 0), communityUrgency: Number(idea.community_urgency ?? 0), communitySupport: Number(idea.community_support ?? 0), aiFeasibility: Number(idea.ai_feasibility ?? feasibility), aiPotential: Number(idea.ai_potential ?? potential), aiUrgency: Number(idea.ai_urgency ?? urgency), aiSupport: Number(idea.ai_acceptability ?? publicSupport), createdAt: String(idea.created_at ?? ""), originalTitle: String(idea.original_title ?? idea.title), originalDescription: String(idea.original_problem ?? idea.problem), sourceLanguage: String(idea.source_language ?? "sr-Latn"), displayedLanguage: String(idea.displayed_language ?? idea.source_language ?? "sr-Latn") };
        }));
      } catch { /* Demo cards remain visible if local persistence is unavailable. */ }
    }
    void loadPublishedIdeas();
    window.addEventListener("glas-language-change", loadPublishedIdeas);
    return () => window.removeEventListener("glas-language-change", loadPublishedIdeas);
  }, []);

  function saveDraft() {
    window.localStorage.setItem("glas-za-reforme-draft", JSON.stringify(draft));
    setDraftMessage("Nacrt je sačuvan na ovom uređaju.");
  }

  async function submitIdea(formData: FormData) {
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idea-owner-key": getIdeaOwnerKey() },
        body: JSON.stringify({
          title: formData.get("title"),
          problem: formData.get("problem"),
          solution: formData.get("solution"),
          ideaType: draft.ideaType,
          sourceLanguage: window.localStorage.getItem("glas-za-reforme-language") === "auto"
            ? document.documentElement.lang
            : window.localStorage.getItem("glas-za-reforme-language") || document.documentElement.lang || "sr-Latn",
        }),
      });
      const result = await response.json() as { error?: string; reason?: string; explanation?: string; visibility?: "public" | "restricted"; queuePosition?: number };
      if (!response.ok) {
        if (result.error === "prohibited_content") {
          setFormError(result.explanation ?? "Predlog nije prihvaćen jer sadrži poziv na nasilje ili teško kršenje prava drugih.");
          return;
        }
        if (result.error === "rate_limited") {
          setFormError(result.reason === "daily" ? "Dostignut je dnevni limit predloga. Sačuvaj nacrt i pokušaj ponovo sutra." : "Poslao/la si više predloga veoma brzo. Nacrt je sačuvan — pokušaj ponovo za deset minuta.");
          saveDraft();
          return;
        }
        if (result.error === "duplicate_submission") {
          setFormError("Ovaj predlog je već poslat i nalazi se među tvojim idejama.");
          return;
        }
        throw new Error("Predlog trenutno nije moguće poslati.");
      }
      setSubmittedVisibility(result.visibility ?? null);
      setSubmittedQueuePosition(result.queuePosition ?? null);
      window.localStorage.removeItem("glas-za-reforme-draft");
      setDraft({ title: "", problem: "", solution: "", ideaType: "reform" });
      setSubmitted(true);
    } catch {
      setFormError("Došlo je do greške. Pokušaj ponovo za nekoliko trenutaka.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Glas za reforme — početna"><span className="brandMark">G</span><span>Glas za <b>reforme</b></span></a>
      <nav aria-label="Glavna navigacija"><a className="active" href="#ideje">Ideje</a><a href="#kako-radi">Kako radi</a><a href="#oblasti">Oblasti</a><a href="/moje-ideje">Moje ideje</a></nav>
      <div className="headerActions"><button className="loginButton" onClick={() => setShowLogin(true)}>Nalog</button><button className="primaryButton small" onClick={() => setShowSubmit(true)}>Predloži reformu <span>↗</span></button></div>
    </header>

    <section className="hero" id="top">
      <div className="heroCopy">
        <div className="eyebrow"><span /> Platforma građanskih predloga</div>
        <h1>Dobri predlozi.<br /><em>Bolja država.</em></h1>
        <p>Predloži promenu, podrži dobre ideje i pomozi da najvažnije reforme stignu do onih koji odlučuju.</p>
        <div className="heroActions"><button className="primaryButton" onClick={() => setShowSubmit(true)}>Predloži reformu <span>↗</span></button><a className="textButton" href="#ideje">Pregledaj ideje <span>↓</span></a></div>
      </div>
      <div className="heroVisual" aria-hidden="true">
        <div className="orb orbOne" /><div className="orb orbTwo" />
        <div className="miniCard cardA"><span className="miniIcon">✦</span><div><small>Analiza potencijala</small><b>8.7 / 10</b></div></div>
        <div className="miniCard cardB"><span className="miniIcon coral">↑</span><div><b>2.847</b><small>glasova građana</small></div></div>
        <div className="routeLine"><i /><i /><i /></div><div className="seal">Ideja<br /><b>u pokretu</b><span>↗</span></div>
      </div>
      <div className="heroStats"><div><b>1.248</b><span>predloženih ideja</span></div><div><b>18.640</b><span>glasova građana</span></div><div><b>24</b><span>oblasti reformi</span></div></div>
    </section>

    <section className="ideasSection" id="ideje">
      <div className="sectionHeading"><div><span className="sectionIndex">01</span><h2>Ideje koje pokreću stvari</h2></div><p>Najbolje ocenjeni predlozi građana, razvrstani po oblastima i analizirani prema jasnim kriterijumima.</p></div>
      <div className="ideaTools">
        <label className="ideaSearch"><span>Pretraži ideje</span><input type="search" value={ideaQuery} onChange={(event) => { setIdeaQuery(event.target.value); setShowAllIdeas(true); }} placeholder="Pretraži po naslovu, opisu, ministarstvu ili oznaci…" /></label>
        <div className="filterRow" aria-label="Način sortiranja"><button className={ideaSort === "popular" ? "filter active" : "filter"} onClick={() => setIdeaSort("popular")} aria-pressed={ideaSort === "popular"}>Najpopularnije</button><button className={ideaSort === "newest" ? "filter active" : "filter"} onClick={() => setIdeaSort("newest")} aria-pressed={ideaSort === "newest"}>Najnovije</button><button className={ideaSort === "feasible" ? "filter active" : "filter"} onClick={() => setIdeaSort("feasible")} aria-pressed={ideaSort === "feasible"}>Najizvodljivije</button><button className={ideaSort === "urgent" ? "filter active" : "filter"} onClick={() => setIdeaSort("urgent")} aria-pressed={ideaSort === "urgent"}>Najhitnije</button></div>
        <label className="ministryFilter"><span>Oblast reforme</span><select value={ideaMinistry} onChange={(event) => { setIdeaMinistry(event.target.value); setShowAllIdeas(true); }}><option value="all">Sve oblasti</option>{ministries.map((ministry) => <option value={ministry} key={ministry}>{ministry}</option>)}</select></label>
      </div>
      {visibleIdeas.length ? <div className="ideaGrid">{visibleIdeas.map((idea) => {
        const isVoted = voted.includes(idea.id);
        return <article className="ideaCard" key={idea.id}>
          <div className="cardTop"><span className="ministry">{idea.ministry}</span>{idea.hot && <span className="trending">↗ U trendu</span>}</div>
          <h3>{idea.title}</h3><p>{idea.description}</p><div className="tagRow">{idea.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          <div className="scoreBlock"><div className="scoreMain"><small>Ukupna ocena</small><b>{idea.score.toFixed(2)}</b></div><div className="scoreBars"><Score label="Izvodljivost za Srbiju" value={idea.feasibility} /><Score label="Potencijal" value={idea.potential} /><Score label="Hitnost" value={idea.urgency} /><Score label="Podrška u Srbiji" value={idea.publicSupport} /></div></div>
          {(idea.feasibility <= 1 || idea.potential <= 2) && <div className="lowScoreNote"><b>!</b><span>{idea.feasibility <= 1 ? "Nažalost, trenutno ne verujemo da je ova ideja izvodljiva u Srbiji." : "Nažalost, trenutno procenjujemo da ova ideja ima veoma nizak potencijal."}</span><button onClick={() => setDiscussionIdea(idea)}>Zatraži proveru</button></div>}
          <div className="predictionNote">{idea.communityCount ? idea.communityCount >= 100 ? "Ocene građana · AI više ne utiče na rezultat" : <><span>Kombinovana ocena · AI uticaj</span> <b>{100 - idea.communityCount}%</b></> : <><span>Početna AI procena</span> · {idea.confidence} <span>pouzdanost</span></>}</div>
          {Boolean(idea.communityCount) && <div className="communityRatings"><span>Ocene zajednice · {idea.communityCount}</span><div><b>I {idea.communityFeasibility?.toFixed(2)}</b><b>P {idea.communityPotential?.toFixed(2)}</b><b>H {idea.communityUrgency?.toFixed(2)}</b><b>J {idea.communitySupport?.toFixed(2)}</b></div></div>}
          <div className="cardFooter"><button className={isVoted ? "voteButton voted" : "voteButton"} onClick={() => openRating(idea)} aria-pressed={isVoted} aria-label="Oceni i podrži ideju"><span>↑</span> {(idea.votes + (isVoted ? 1 : 0)).toLocaleString("sr-RS")}</button><button className="detailsButton" onClick={() => setDiscussionIdea(idea)}>Ideja i komentari <span>↗</span></button></div>
        </article>;
      })}</div> : <div className="emptyIdeas"><b>Nema ideja koje odgovaraju izabranim filterima.</b><p>Promeni pretragu, oblast ili način sortiranja.</p><button className="outlineButton" onClick={clearIdeaFilters}>Obriši filtere</button></div>}
      {filteredIdeas.length > 8 && <button className="outlineButton" onClick={() => setShowAllIdeas((current) => !current)}>{showAllIdeas ? "Prikaži manje" : "Pogledaj sve ideje"} <span>{showAllIdeas ? "↑" : "→"}</span></button>}
    </section>

    <section className="howSection" id="kako-radi">
      <div className="sectionHeading"><div><span className="sectionIndex">02</span><h2>Od predloga do podrške</h2></div><p>Jasan proces čuva kvalitet diskusije i pomaže da svaka ideja stigne do nadležne oblasti.</p></div>
      <div className="steps">
        <article><b>01</b><span className="stepIcon">✎</span><h3>Opiši problem</h3><p>Napiši šta ne funkcioniše, koga pogađa i kako bi tvoje rešenje izgledalo.</p></article>
        <article><b>02</b><span className="stepIcon">✦</span><h3>AI razvrstava</h3><p>Llama predlaže ministarstva, sektore i oznake, a moderatori potvrđuju klasifikaciju.</p></article>
        <article><b>03</b><span className="stepIcon">◎</span><h3>Procena reakcije</h3><p>Odvojeno procenjujemo kvalitet ideje i verovatnu podršku javnosti u Srbiji.</p></article>
        <article><b>04</b><span className="stepIcon">↑</span><h3>Građani glasaju</h3><p>Javni predlozi prikupljaju podršku i najjači ulaze u periodične izveštaje.</p></article>
      </div>
      <aside className="methodNote"><b>Lokalni kontekst, ne apstraktna teorija.</b><p>Podrška predviđa kako bi građani Srbije verovatno glasali danas — nije moralna ocena. Izvodljivost meri da li Srbija može da finansira i sprovede predlog svojim budžetom, institucijama, pravnim ovlašćenjima i infrastrukturom. Pozivi na nasilje i grupnu mržnju se blokiraju, a mogući pravni konflikti zahtevaju ljudsku proveru.</p><div><a href="https://www.worldvaluessurvey.org/WVSContents.jsp?CMSID=Documentation" target="_blank" rel="noreferrer">World Values Survey ↗</a><a href="https://www.ipsos.com/en-us/news-polls/global-attitudes-toward-transgender-people" target="_blank" rel="noreferrer">Ipsos globalna istraživanja ↗</a></div></aside>
    </section>

    <section className="sectorsSection" id="oblasti">
      <div className="sectorTitle"><span className="sectionIndex">03</span><h2>Oblasti reformi</h2></div>
      <div className="sectorList">{sectorSummaries.map(({ ministry, count }) => <button onClick={() => chooseMinistry(ministry)} key={ministry}>{ministry} <b>{count}</b></button>)}</div>
    </section>

    <section className="submitBand" id="predlozi"><div><span className="sectionIndex light">04</span><h2>Imaš ideju koja<br />može da promeni stvari?</h2></div><div className="submitCopy"><p>Opiši problem i svoje rešenje. Naš AI asistent će pomoći da predlog stigne u pravu oblast i dobije početnu procenu.</p><button className="lightButton" onClick={() => setShowSubmit(true)}>Započni predlog <span>↗</span></button><small>Osetljive predloge možeš poslati u ograničenu moderacionu obradu.</small></div></section>

    <footer><a className="brand" href="#top"><span className="brandMark">G</span><span>Glas za <b>reforme</b></span></a><p>Građanska platforma za argumentovane ideje i bolju javnu upravu.</p><div><a href="#ideje">Ideje</a><a href="#kako-radi">Kako radi</a><a href="#oblasti">Oblasti</a></div><small>© 2026 Glas za reforme</small></footer>

    {discussionIdea && <IdeaDiscussion idea={{ id: discussionIdea.id, title: discussionIdea.title, description: discussionIdea.description, feasibility: discussionIdea.feasibility, potential: discussionIdea.potential, urgency: discussionIdea.urgency, urgencyBasis: discussionIdea.urgencyBasis, originalTitle: discussionIdea.originalTitle, originalDescription: discussionIdea.originalDescription, sourceLanguage: discussionIdea.sourceLanguage, displayedLanguage: discussionIdea.displayedLanguage }} commentsEnabled={discussionIdea.persisted} onClose={() => setDiscussionIdea(null)} />}

    {ratingIdea && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRatingIdea(null); }}>
      <section className="modal ratingModal" role="dialog" aria-modal="true" aria-labelledby="rating-title">
        <button className="modalClose" onClick={() => setRatingIdea(null)} aria-label="Zatvori">×</button>
        <span className="modalKicker">Tvoja procena</span><h2 id="rating-title">Oceni i podrži ideju</h2><p className="modalIntro">Početne vrednosti su zaokružene platformske procene. Promeni ih prema svom mišljenju; tvoj glas podrške računa se samo jednom.</p>
        <form onSubmit={submitRating} className="categoryRatingForm">
          <RatingInput label="Izvodljivost za Srbiju" value={ratingDraft.feasibility} onChange={(value) => setRatingDraft({ ...ratingDraft, feasibility: value })} />
          <RatingInput label="Potencijal" value={ratingDraft.potential} onChange={(value) => setRatingDraft({ ...ratingDraft, potential: value })} />
          <RatingInput label="Hitnost" value={ratingDraft.urgency} onChange={(value) => setRatingDraft({ ...ratingDraft, urgency: value })} />
          <RatingInput label="Podrška u Srbiji" value={ratingDraft.support} onChange={(value) => setRatingDraft({ ...ratingDraft, support: value })} />
          <p className="ratingNote">Ocene su tvoje mišljenje. Pozivi na nasilje i drugi zabranjeni sadržaji ne mogu se opravdati glasanjem.</p>
          {ratingError && <p className="formError" role="alert">{ratingError}</p>}
          <button className="primaryButton submitButton" disabled={ratingSubmitting}>{ratingSubmitting ? "Čuvanje…" : voted.includes(ratingIdea.id) ? "Ažuriraj moje ocene" : "Sačuvaj ocene i podrži"} <span>↗</span></button>
        </form>
      </section>
    </div>}

    {showSubmit && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSubmit(false); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button className="modalClose" onClick={() => setShowSubmit(false)} aria-label="Zatvori">×</button>
        {!submitted ? <>
          <span className="modalKicker">Novi predlog</span><h2 id="modal-title">Tvoja ideja</h2><p className="modalIntro">Predloži državnu reformu ili način da sama platforma postane bolja.</p>
          <form action={submitIdea}>
            <fieldset className="ideaTypeChoice"><legend>Vrsta ideje</legend><label aria-label="Reforma države" htmlFor="idea-type-reform" className={draft.ideaType === "reform" ? "selected" : ""}><input id="idea-type-reform" type="radio" name="ideaType" value="reform" checked={draft.ideaType === "reform"} onChange={() => setDraft({ ...draft, ideaType: "reform" })} /><span><b>Reforma države</b><small>Zakoni, institucije i javne usluge</small></span></label><label aria-label="Poboljšanje platforme" htmlFor="idea-type-platform" className={draft.ideaType === "platform" ? "selected" : ""}><input id="idea-type-platform" type="radio" name="ideaType" value="platform" checked={draft.ideaType === "platform"} onChange={() => setDraft({ ...draft, ideaType: "platform" })} /><span><b>Poboljšanje platforme</b><small>Funkcije, pravila i korisničko iskustvo</small></span></label></fieldset>
            <label>Naslov ideje<input name="title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required minLength={8} maxLength={120} placeholder="Na primer: Jedinstveni portal za lokalne takse" /></label>
            <label>Koji problem rešava?<textarea name="problem" value={draft.problem} onChange={(event) => setDraft({ ...draft, problem: event.target.value })} required minLength={30} maxLength={1500} placeholder="Opiši sadašnje stanje i koga problem pogađa…" /></label>
            <label>Kako bi izgledalo rešenje?<textarea name="solution" value={draft.solution} onChange={(event) => setDraft({ ...draft, solution: event.target.value })} required minLength={30} maxLength={2500} placeholder="Objasni predlog, očekivani rezultat i moguće prepreke…" /></label>
            <div className="draftRow"><button type="button" className="draftButton" onClick={saveDraft}>Sačuvaj nacrt</button><small>{draftMessage || "Nacrt ostaje samo na ovom uređaju dok ga ne pošalješ."}</small></div>
            <div className="autoProcessing"><span>✦</span><div><b>Automatski način obrade</b><p>Sistem bira nadležnu oblast, oznake i nivo provere. Ti biraš samo da li želiš da menjaš državu ili ovu platformu.</p></div></div>
            <div className="safetyNote"><b>Važno:</b> Ne unosi državne tajne, lične podatke trećih lica ili materijal čije posedovanje nije dozvoljeno. Ova platforma nije državni kanal za klasifikovane informacije.</div>
            <div className="rulesNote"><b>Pravila predloga</b><span>Ne prihvatamo pozive na nasilje, istrebljenje ili proterivanje grupa, govor mržnje, niti predloge koji očigledno ukidaju osnovna prava. Potencijalni pravni konflikti idu na stručnu proveru pre objave.</span></div>
            {formError && <p className="formError" role="alert">{formError}</p>}
            <button className="primaryButton submitButton" disabled={submitting}>{submitting ? "Slanje…" : "Pošalji na analizu"}<span>↗</span></button>
          </form>
        </> : <div className="successState"><span>✓</span><h2>Predlog je u redu za obradu</h2><p>{submittedVisibility === "restricted" ? "Predlog čeka ograničenu ljudsku proveru i neće biti javno prikazan bez odobrenja." : `Predlog je sačuvan i čeka Llama analizu${submittedQueuePosition ? ` na mestu ${submittedQueuePosition}` : ""}. Možeš bezbedno zatvoriti stranicu.`}</p><a className="primaryButton" href="/moje-ideje">Prati obradu <span>↗</span></a></div>}
      </section>
    </div>}

    {showLogin && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowLogin(false); }}>
      <section className="modal loginModal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="modalClose" onClick={() => setShowLogin(false)} aria-label="Zatvori">×</button>
        <span className="modalKicker">Pristup u razvoju</span><h2 id="login-title">Nastavi kao gost.</h2>
        <p className="modalIntro">OAuth provajderi još nisu povezani. Sve trenutne funkcije možeš koristiti bez naloga na ovom uređaju.</p>
        <div className="oauthGrid">
          <button className="oauthButton google" disabled><span>G</span><b>Nastavi uz Google</b><small>uskoro</small></button>
          <button className="oauthButton apple" disabled><span>●</span><b>Nastavi uz Apple</b><small>uskoro</small></button>
          <button className="oauthButton x" disabled><span>𝕏</span><b>Nastavi uz X</b><small>uskoro</small></button>
          <button className="oauthButton tiktok" disabled><span>♪</span><b>Nastavi uz TikTok</b><small>uskoro</small></button>
          <button className="oauthButton instagram" disabled><span>◎</span><b>Nastavi uz Instagram</b><small>provera pristupa</small></button>
          <button className="oauthButton chatgpt" disabled><span>✦</span><b>Nastavi uz ChatGPT</b><small>nije povezano</small></button>
        </div>
        <div className="orDivider"><span>ili</span></div>
        <button className="primaryButton guestButton" onClick={() => setShowLogin(false)}>Nastavi bez prijave <span>↗</span></button>
        <p className="loginPrivacy">Gostujući pristup čuva nacrte i tvoje ideje u ovom pregledaču. Kada OAuth bude povezan, nalog će omogućiti pristup sa više uređaja.</p>
      </section>
    </div>}
  </main>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="scoreRow"><span>{label}</span><i><b style={{ width: `${value * 10}%` }} /></i><strong>{value.toFixed(2)}</strong></div>;
}

function RatingInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="categoryRating"><span>{label}</span><input type="range" min="0" max="10" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} /><output>{value}</output></label>;
}
