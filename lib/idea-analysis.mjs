const normalize = (input) => input.toLocaleLowerCase("sr-Latn").replace(/[^a-zčćžšđа-яё0-9\s]/giu, " ").replace(/\s+/g, " ").trim();

export function moderateSubmission(input) {
  const text = normalize(input);
  const protectedGroups = "albanc|albanian|srba|srbe|serb|hrvat|croat|bošnjak|bosniak|musliman|muslim|jevrej|jew|rom[aei]|roma|mađar|hungarian|crnogor|kosovar|izbeglic|refugee|migrant|gej|gay|lezbej|lesbian|transrod|transgender|lgbt|pravoslav|orthodox|katolik|catholic";
  const violentVerb = "ubij|kill|likvidir|execute|strelj|istrebi|exterminat|zakolj|proter|protjer|expel|deport|muč|tortur|siluj|rape|spal";
  const collectiveViolence = new RegExp(`(?:${violentVerb})[a-zčćžšđа-яё]*\\s+(?:(?:sve|svakog|čitav)[a-zčćžšđа-яё]*\\s+|all\\s+(?:the\\s+)?)(?:${protectedGroups})`, "iu");
  const targetedIncitement = new RegExp(`(?:treba|moramo|hoćemo|hajde da|should|must|let us)\\s+(?:${violentVerb})[a-zčćžšđа-яё]*[^.]{0,60}(?:${protectedGroups})`, "iu");
  const explicitAtrocity = /(etničko čišćenje|ethnic cleansing|genocid nad|genocide against|istrebljenje|extermination|smrt svim|death to all|gasne komore|gas chambers|masovna egzekucija|mass execution)/iu;
  if (collectiveViolence.test(text) || targetedIncitement.test(text) || explicitAtrocity.test(text)) {
    return {
      status: "blocked", code: "group_violence", reason: "poziv na grupno nasilje ili zločin",
      explanation: "Predlog je odbijen jer poziva na nasilje, progon ili zločin prema grupi ljudi. Platforma prihvata kritiku politika i institucija, ali ne i napade na ljude zbog vere, porekla ili drugog ličnog svojstva.",
    };
  }

  const publicPersonThreat = new RegExp(`(?:ubij|kill|likvidir|execute|strelj)[a-zčćžšđа-яё]*\\s+(?:aleksandr?[a-z]*\\s+)?(?:vučić|vucic|vucica|predsednik[a-z]*|premijer[a-z]*|ministar[a-z]*)`, "iu");
  const lynchingOrTargetedAttack = /(linčuj|lincuj|prebij|pretuci|zakolj|ubij ovog|ubij tog|ubij njega|ubij nju|kill him|kill her|lynch (?:him|her|this|that)|(?:let s|let us|should|must) lynch)[a-zčćžšđа-яё]*/iu;
  if (publicPersonThreat.test(text) || lynchingOrTargetedAttack.test(text)) {
    return {
      status: "blocked", code: "targeted_violence", reason: "pretnja ili poziv na nasilje prema osobi",
      explanation: "Pozivi na linč, napad ili ubistvo nisu dozvoljeni. Pravdu treba da sprovode nadležni organi u zakonitom postupku, a cilj platforme je da pomogne da te institucije rade odgovorno i efikasno. Kritika, prijava sumnje i predlog za smenu su dozvoljeni; nasilje nije.",
    };
  }

  const legalReviewPatterns = [
    /ukinuti pravo glasa/iu, /zabraniti veru|zabraniti vjeru/iu,
    /kolektivno proterivanje|kolektivno protjerivanje/iu,
    /mučenje zatvorenika|mučenje osumnjičenih/iu, /oduzeti državljanstvo svim/iu,
  ];
  if (legalReviewPatterns.some((pattern) => pattern.test(text))) {
    return {
      status: "legal_review", code: "rights_review", reason: "mogući sukob sa ustavnim ili međunarodnim pravima",
      explanation: "Predlog nije automatski odbijen, ali ostaje skriven dok pravna provera ne utvrdi da li je usklađen sa Ustavom Srbije i međunarodnim obavezama.",
    };
  }
  return { status: "clear", code: "clear", reason: null, explanation: null };
}

export function determineVisibility(input, safetyStatus) {
  return classifySubmission(input, safetyStatus).recommendedVisibility === "private" ? "restricted" : "public";
}

export function classifySubmission(input, safetyStatus = "clear") {
  const text = normalize(input);
  const corruptionSignals = [
    "korupc", "mito", "podmić", "podmic", "namešten tender", "namesten tender", "zloupotreba položaja",
    "zloupotreba polozaja", "pronever", "reket", "trgovina uticajem", "sukob interesa", "lažna javna nabavka",
  ];
  const reportingSignals = [
    "prijavljujem", "prijava", "sumnja na", "imam dokaz", "imamo dokaz", "postoje pokazatelji",
    "konkretan slučaj", "konkretan slucaj", "uzbunjivač", "uzbunjivac", "reporting", "evidence of",
  ];
  if (corruptionSignals.some((signal) => text.includes(signal)) && reportingSignals.some((signal) => text.includes(signal))) {
    return { kind: "corruption", label: "Prijava korupcije", recommendedVisibility: "private", forcePrivate: true };
  }
  const sensitiveSignals = [
    "bezbednosni propust", "sigurnosni propust", "kritična infrastruktura", "kriticna infrastruktura",
    "vojni objekat", "operativni detalji", "identitet uzbunjivača", "identitet uzbunjivaca",
    "državna tajna", "drzavna tajna", "klasifikovan", "poverljiv dokument", "povjerljiv dokument",
    "lični podaci", "licni podaci", "jmbg", "broj pasoša", "broj pasosa",
  ];
  if (sensitiveSignals.some((signal) => text.includes(signal))) {
    return { kind: "sensitive", label: "Osetljiva prijava", recommendedVisibility: "private", forcePrivate: true };
  }
  const platformSignals = [
    "ova platforma", "na platformi", "sajt", "website", "aplikacija", "prijava korisnika", "login", "filter ideja",
    "komentari na ideje", "glasanje na platformi", "korisničko iskustvo", "moderacija platforme",
  ];
  if (platformSignals.some((signal) => text.includes(signal))) {
    return { kind: "platform", label: "Razvoj platforme", recommendedVisibility: safetyStatus === "legal_review" ? "private" : "public", forcePrivate: safetyStatus === "legal_review" };
  }
  return { kind: "reform", label: "Predlog reforme", recommendedVisibility: safetyStatus === "legal_review" ? "private" : "public", forcePrivate: safetyStatus === "legal_review" };
}

export function classifyLocally(input, ideaType = "reform") {
  const text = normalize(input);
  if (ideaType === "platform") {
    return {
      ministry: "Razvoj platforme", sectors: ["Platforma"], tags: ["Poboljšanje platforme", "Predlog zajednice"],
      feasibility: estimateSerbianFeasibility(text), potential: 7, urgency: estimateUrgency(text), publicSupport: estimateSerbianPublicSupport(text),
    };
  }
  const candidates = [
    { words: ["škola", "učenik", "ucenik", "nastav", "udžben", "profesor", "obrazov", "education", "student"], ministry: "Prosveta", tag: "Obrazovanje" },
    { words: ["bolnic", "lekar", "zdrav", "pacijent"], ministry: "Zdravlje", tag: "Zdravstvo" },
    { words: ["porez", "tax", "privred", "budžet", "firma", "fond", "invest", "valut", "currency", "dobavljač", "supplier", "small business"], ministry: "Finansije", tag: "Privreda" },
    { words: ["sud", "zakon", "tužila", "pravd"], ministry: "Pravosuđe", tag: "Pravo" },
    { words: ["otpad", "vazduh", "voda", "zelen"], ministry: "Životna sredina", tag: "Ekologija" },
  ];
  const match = candidates.find((candidate) => candidate.words.some((word) => text.includes(word)));
  const highPotential = ["personaliz", "personalizovan", "veštačka inteligencija", "vestacka inteligencija", "artificial intelligence", "dobavljač", "supplier", "mala preduzeća", "small business", "privatni građani", "private citizens"].some((term) => text.includes(term));
  return {
    ministry: match?.ministry ?? "Državna uprava", sectors: [match?.tag ?? "Javne usluge"],
    tags: [match?.tag ?? "Uprava", "Predlog građana"], feasibility: estimateSerbianFeasibility(text),
    potential: highPotential ? 8.5 : 7.5, urgency: estimateUrgency(text), publicSupport: estimateSerbianPublicSupport(text),
  };
}

export function estimateUrgency(textInput) {
  const text = normalize(textInput);
  let score = 5; let confidence = .35; const basis = [];
  const has = (...terms) => terms.some((term) => text.includes(term));
  if (has("kolonija na mesecu", "moon colony", "colonize the moon", "kolonizacija meseca", "svemirska kolonija")) {
    return { score: 2, confidence: .9, basis: "dugoročna ambicija bez neposredne štete ako se odloži" };
  }
  if (has("lista čekanja", "liste čekanja", "hitna pomoć", "pacijent", "epidem", "poplav", "požar", "nasilje", "bezbednosni propust", "waiting list", "hospital", "patient", "treatment is delayed", "emergency")) {
    score += 3.2; confidence = Math.max(confidence, .75); basis.push("odlaganje može neposredno ugroziti zdravlje ili bezbednost ljudi");
  }
  if (has("zagađen", "kvalitet vazduha", "pijaća voda", "otrov", "opasan otpad")) {
    score += 2.5; confidence = Math.max(confidence, .7); basis.push("šteta po zdravlje ili životnu sredinu raste dok se čeka");
  }
  if (has("ne plaća dobavljač", "ne plaća dobavljač", "kasni sa plaćanjem", "duguju malim firmama", "neisplaćen", "neisplacen", "zaostale zarade")) {
    score += 2; confidence = Math.max(confidence, .65); basis.push("odlaganje povećava tekuću finansijsku štetu radnicima ili malim firmama");
  }
  if (has("deca bez", "učenici bez", "nedostaju udžbenici", "školska godina")) {
    score += 1.4; confidence = Math.max(confidence, .55); basis.push("odlaganje utiče na tekuću školsku generaciju");
  }
  if (has("dugoročna vizija", "istraživanje", "razvoj fonda", "buduća tehnologija")) {
    score -= 1.2; basis.push("korist je pretežno dugoročna i vreme primene je fleksibilnije");
  }
  return { score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)), confidence, basis: basis.length ? basis.join("; ") : "nije utvrđena neposredna šteta od umerenog odlaganja" };
}

export function estimateSerbianFeasibility(textInput) {
  const text = normalize(textInput);
  let score = 6; let confidence = .35; const basis = [];
  const has = (...terms) => terms.some((term) => text.includes(term));
  if (has("kolonizacija meseca", "kolonizovati mesec", "kolonija na mesecu", "naselje na mesecu", "kolonizacija marsa", "svemirska kolonija", "colonize the moon", "colonizing the moon", "moon colony")) {
    return { score: 0, confidence: .98, basis: "daleko izvan budžeta, infrastrukture i institucionalnog kapaciteta Srbije" };
  }
  if (has("svemirski program", "nosač aviona", "nuklearna elektrana") && has("samostalno", "domaći", "izgraditi")) { score -= 4.5; confidence = .8; basis.push("kapitalni i tehnološki zahtevi prevazilaze sadašnji domaći kapacitet"); }
  if (has("promena ustava", "izmena ustava", "dvotrećinska većina", "referendum")) { score -= 2.2; confidence = Math.max(confidence, .7); basis.push("zahteva složenu ustavnu proceduru"); }
  if (has("u celoj srbiji", "svim građanima", "potpuno besplatno", "univerzalni osnovni dohodak")) { score -= 1.5; confidence = Math.max(confidence, .55); basis.push("visok fiskalni i operativni obuhvat"); }
  if (has("digitaliz", "jedinstveni portal", "otvoreni podaci", "transparentne liste", "pilot projekat", "artificial intelligence", "veštačka inteligencija", "vestacka inteligencija", "ai ")) { score += 1.2; confidence = Math.max(confidence, .6); basis.push("moguća postepena primena kroz postojeće digitalne kapacitete"); }
  if (has("opština", "lokalna samouprava", "pilot")) { score += .7; basis.push("moguća postepena ili lokalna primena"); }
  return { score: Math.max(0, Math.min(10, Math.round(score * 10) / 10)), confidence, basis: basis.length ? basis.join("; ") : "potrebna detaljna budžetska, pravna i institucionalna procena" };
}

export function estimateSerbianPublicSupport(textInput) {
  const text = normalize(textInput);
  let score = 6; let evidenceSignals = 0; const basis = [];
  const has = (...terms) => terms.some((term) => text.includes(term));
  if (has("transparent", "korupc", "lista čekanja", "manje šaltera", "digitaliz")) { score += 1.4; evidenceSignals++; basis.push("široko prihvaćena efikasnost i transparentnost"); }
  if (has("manji porez", "niži porez", "smanjenje troškova", "besplatni udžben")) { score += .7; evidenceSignals++; basis.push("direktna materijalna korist"); }
  if (has("evropska unija", "članstvo u eu", "nato")) { score -= 2; evidenceSignals++; basis.push("polarizovana geopolitička tema"); }
  if (has("transrod", "rodna tranzic", "promena pola", "promjena pola", "rodni identitet", "lgbt", "istopoln")) { score -= 2.4; evidenceSignals++; basis.push("društveno polarizovana tema"); }
  if (has("malolet", "maloljet", "deca", "djeca", "dete", "dijete") && has("transrod", "tranzic", "promena pola", "rodni identitet")) { score -= 2.1; evidenceSignals++; basis.push("politika se odnosi na maloletnike"); }
  if (has("besplat", "o trošku države", "država plaća", "javno finansiran") && has("operacij", "hirur", "tranzic", "promena pola")) { score -= .8; basis.push("potpuno javno finansiranje polarizovane mere"); }
  return { score: Math.max(1, Math.min(10, Math.round(score * 10) / 10)), confidence: evidenceSignals >= 2 ? .55 : .3, basis: basis.length ? basis.join("; ") : "nema dovoljno domaćih anketnih podataka — početna procena" };
}
