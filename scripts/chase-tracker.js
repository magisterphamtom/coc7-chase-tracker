/**
 * CoC7 – Suivi de Poursuites
 * Tableau de poursuite (à pied / en voiture) : glisser-déposer des
 * participants, jauge d'écart, jet de Chance automatisé, idées
 * d'obstacles originales (non officielles).
 *
 * Système original et simplifié, PAS une reproduction des règles
 * officielles de poursuite d'un quelconque manuel. Les seuils sont des
 * valeurs par défaut ajustables à volonté.
 */

const MODULE_ID = "coc7-chase-tracker";
const SETTING_KEY = "state";
const DRAG_MIME = "application/x-coc7-chase-participant";

const DEFAULT_STATE = {
  mode: "foot", // "foot" | "car"
  era: "1933", // "1933" | "modern"
  gap: 5,
  maxGap: 10,
  lastDelta: 0,
  participants: [],
  log: []
};

const SKILLS_FOOT = ["Chance", "Esquive", "Athlétisme", "Discrétion", "Escalade", "DEX"];
const SKILLS_CAR = ["Chance", "Conduite Automobile", "Mécanique", "Repérer", "DEX"];

/* Idées d'obstacles originales — pas la table officielle d'un manuel. */
const OBSTACLE_IDEAS = {
  foot: {
    1933: [
      "Une caisse de ravitaillement renversée dans le couloir",
      "Un chien de traîneau affolé qui bondit au passage",
      "Une plaque de glace traîtresse sous le pas",
      "Une porte coincée par le gel",
      "Un vent violent qui aveugle un instant"
    ],
    modern: [
      "Un étal de marché renversé sur le trottoir",
      "Une porte à badge verrouillée",
      "Une foule dense à contourner",
      "Un chantier avec des barrières à franchir",
      "Une flaque qui rend le sol glissant"
    ]
  },
  car: {
    1933: [
      "Un troupeau qui traverse la route",
      "Une ornière boueuse profonde",
      "Un passage à niveau qui commence à se fermer",
      "Un moteur capricieux dans le froid",
      "Un pont de bois instable"
    ],
    modern: [
      "Un feu qui passe au rouge devant un flux de piétons",
      "Un bouchon soudain",
      "Une sortie d'autoroute prise au dernier moment",
      "Des travaux qui rétrécissent la voie",
      "Une pluie battante qui réduit la visibilité"
    ]
  }
};

/* ------------------------------------------------------------------ */
/*  Réglage monde qui stocke l'état de la poursuite                    */
/* ------------------------------------------------------------------ */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_STATE
  });
});

function getState() {
  const stored = game.settings.get(MODULE_ID, SETTING_KEY);
  return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_STATE), stored ?? {});
}

async function setState(patch) {
  const next = foundry.utils.mergeObject(getState(), patch, { inplace: false });
  await game.settings.set(MODULE_ID, SETTING_KEY, next);
  return next;
}

function clampGap(value, maxGap) {
  return Math.max(0, Math.min(maxGap, value));
}

function pushLog(state, text) {
  const entry = { text, id: foundry.utils.randomID() };
  return [entry, ...state.log].slice(0, 25);
}

/* ------------------------------------------------------------------ */
/*  Lecture de la Chance sur un acteur (même logique que le module      */
/*  CoC7 – Suivi de Chance, pour rester cohérent)                       */
/* ------------------------------------------------------------------ */
function getLuckValue(actor) {
  const sys = actor?.system ?? {};
  const candidates = [
    sys?.attribs?.lck?.value,
    sys?.attribs?.luck?.value,
    sys?.characteristics?.lck?.value,
    sys?.characteristics?.luck?.value
  ];
  const value = candidates.find((v) => typeof v === "number" && !Number.isNaN(v));
  return typeof value === "number" ? value : null;
}

function getMoveValue(actor) {
  const sys = actor?.system ?? {};
  const candidates = [sys?.attribs?.mov?.value, sys?.characteristics?.mov?.value];
  const value = candidates.find((v) => typeof v === "number" && !Number.isNaN(v));
  return typeof value === "number" ? value : null;
}

/* ------------------------------------------------------------------ */
/*  Actions de haut niveau                                             */
/* ------------------------------------------------------------------ */
async function setMode(mode) {
  await setState({ mode });
}

async function setEra(era) {
  await setState({ era });
}

async function adjustGap(delta) {
  const state = getState();
  const gap = clampGap(state.gap + delta, state.maxGap);
  await setState({ gap, lastDelta: gap - state.gap });
}

async function addParticipant({ name, role, move, kind, actorId, img }) {
  const trimmedName = (name ?? "").trim();
  if (!trimmedName) return;
  const state = getState();

  if (actorId && state.participants.some((p) => p.actorId === actorId)) {
    // Déjà présent : on ne duplique pas.
    return;
  }

  const participants = [
    ...state.participants,
    {
      id: foundry.utils.randomID(),
      name: trimmedName,
      role: role === "quarry" ? "quarry" : "pursuer",
      move: Number.isFinite(Number(move)) ? Number(move) : null,
      kind: kind === "vehicle" ? "vehicle" : "person",
      actorId: actorId ?? null,
      img: img ?? null
    }
  ];
  await setState({ participants });
}

async function addParticipantFromDocument(doc, role) {
  if (!doc) return;
  const isItem = doc.documentName === "Item";
  const typeStr = String(doc.type ?? "").toLowerCase();
  const looksLikeVehicle =
    isItem ||
    typeStr.includes("vehic") ||
    typeStr.includes("car") ||
    typeStr.includes("boat") ||
    typeStr.includes("plane");

  await addParticipant({
    name: doc.name,
    role,
    move: !isItem ? getMoveValue(doc) : null,
    kind: looksLikeVehicle ? "vehicle" : "person",
    actorId: !isItem ? doc.id : null,
    img: doc.img
  });
}

async function setDriver(participantId, driverActorId) {
  const state = getState();
  const participants = state.participants.map((p) =>
    p.id === participantId ? { ...p, driverActorId } : p
  );
  await setState({ participants });
}

async function removeDriver(participantId) {
  await setDriver(participantId, null);
}

async function setParticipantRole(id, role) {
  const state = getState();
  const participants = state.participants.map((p) =>
    p.id === id ? { ...p, role: role === "quarry" ? "quarry" : "pursuer" } : p
  );
  await setState({ participants });
}

async function deleteParticipant(id) {
  const state = getState();
  await setState({ participants: state.participants.filter((p) => p.id !== id) });
}

async function recordObstacle(participantId, skill, severity, success) {
  const state = getState();
  const participant = state.participants.find((p) => p.id === participantId);
  if (!participant) return;

  const magnitude = severity === "major" ? 2 : 1;
  let delta;
  if (participant.role === "pursuer") {
    delta = success ? -magnitude : magnitude;
  } else {
    delta = success ? magnitude : -magnitude;
  }

  const gap = clampGap(state.gap + delta, state.maxGap);
  const actualDelta = gap - state.gap;
  const roleLabel = participant.role === "pursuer" ? "Poursuivant" : "Poursuivi";
  const resultLabel = success ? "Réussite" : "Échec";
  const severityLabel = severity === "major" ? "majeur" : "mineur";
  const signedDelta = delta > 0 ? `+${delta}` : `${delta}`;
  const text = `${participant.name} (${roleLabel}) — ${skill} — ${resultLabel} ${severityLabel} — Écart ${signedDelta}`;

  await setState({ gap, lastDelta: actualDelta, log: pushLog(state, text) });
}

async function rollChanceForParticipant(participantId, severity) {
  const state = getState();
  const participant = state.participants.find((p) => p.id === participantId);
  if (!participant) return;

  const relevantActorId = participant.actorId ?? participant.driverActorId;
  if (!relevantActorId) return;
  const actor = game.actors.get(relevantActorId);
  if (!actor) return;

  const luck = getLuckValue(actor);
  if (luck === null) {
    ui.notifications?.warn("Impossible de trouver la valeur de Chance sur cette fiche.");
    return;
  }

  const roll = new Roll("1d100");
  await roll.evaluate();
  const success = roll.total <= luck;

  const label = participant.kind === "vehicle" ? `${participant.name} (conducteur : ${actor.name})` : actor.name;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Jet de Chance (Poursuite) — ${label} — ${success ? "Réussite" : "Échec"} (cible ${luck})`
  });

  await recordObstacle(participantId, "Chance", severity, success);
}

async function resetChase() {
  const state = getState();
  await setState({ gap: Math.round(state.maxGap / 2), lastDelta: 0, log: [] });
}

async function clearAll() {
  await game.settings.set(MODULE_ID, SETTING_KEY, foundry.utils.deepClone(DEFAULT_STATE));
}

function getMarkerInfo(state) {
  const pursuer = state.participants.find((p) => p.role === "pursuer" && (p.img || p.actorId));
  const quarry = state.participants.find((p) => p.role === "quarry" && (p.img || p.actorId));
  return {
    pursuerImg: pursuer?.img ?? null,
    pursuerName: pursuer?.name ?? null,
    quarryImg: quarry?.img ?? null,
    quarryName: quarry?.name ?? null
  };
}

/* ------------------------------------------------------------------ */
/*  Fenêtre en lecture seule (visible par tous) : juste la jauge       */
/* ------------------------------------------------------------------ */
class ChaseGaugeApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "coc7-chase-gauge-app",
    tag: "div",
    window: {
      title: "COC7CHASE.GaugeWindowTitle",
      icon: "fa-solid fa-gauge-simple-high",
      resizable: false
    },
    position: { width: 700, height: "auto" }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/chase-gauge.hbs` }
  };

  /** @override */
  async _prepareContext(_options) {
    const state = getState();
    const markers = getMarkerInfo(state);
    return {
      isFoot: state.mode === "foot",
      isCar: state.mode === "car",
      gap: state.gap,
      maxGap: state.maxGap,
      gapPercent: Math.round((state.gap / state.maxGap) * 100),
      caught: state.gap <= 0,
      escaped: state.gap >= state.maxGap,
      gaining: state.lastDelta > 0,
      losing: state.lastDelta < 0,
      ...markers
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Fenêtre d'affichage (ApplicationV2)                                */
/* ------------------------------------------------------------------ */
class ChaseTrackerApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "coc7-chase-tracker-app",
    tag: "div",
    window: {
      title: "COC7CHASE.WindowTitle",
      icon: "fa-solid fa-gauge-high",
      resizable: true
    },
    position: { width: 720, height: "auto" },
    actions: {
      setModeFoot: ChaseTrackerApp.onSetModeFoot,
      setModeCar: ChaseTrackerApp.onSetModeCar,
      setEra1933: ChaseTrackerApp.onSetEra1933,
      setEraModern: ChaseTrackerApp.onSetEraModern,
      gapMinus: ChaseTrackerApp.onGapMinus,
      gapPlus: ChaseTrackerApp.onGapPlus,
      deleteParticipant: ChaseTrackerApp.onDeleteParticipant,
      deleteDriver: ChaseTrackerApp.onDeleteDriver,
      obstacleSuccess: ChaseTrackerApp.onObstacleSuccess,
      obstacleFailure: ChaseTrackerApp.onObstacleFailure,
      rollChance: ChaseTrackerApp.onRollChance,
      resetChase: ChaseTrackerApp.onResetChase,
      clearAll: ChaseTrackerApp.onClearAll,
      toggleIdeas: ChaseTrackerApp.onToggleIdeas
    }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/chase-tracker.hbs` }
  };

  #ideasOpen = false;

  /** @override */
  async _prepareContext(_options) {
    const state = getState();
    const skillSuggestions = state.mode === "car" ? SKILLS_CAR : SKILLS_FOOT;
    const ideas = OBSTACLE_IDEAS[state.mode]?.[state.era] ?? [];

    const decorate = (p) => {
      const driver = p.driverActorId ? game.actors.get(p.driverActorId) : null;
      return {
        ...p,
        isVehicle: p.kind === "vehicle",
        icon: p.kind === "vehicle" ? "fa-car-side" : "fa-person",
        driverName: driver?.name ?? null,
        driverImg: driver?.img ?? null,
        canRollChance: Boolean(p.actorId) || Boolean(p.driverActorId)
      };
    };

    const markers = getMarkerInfo(state);

    return {
      mode: state.mode,
      era: state.era,
      isFoot: state.mode === "foot",
      isCar: state.mode === "car",
      is1933: state.era === "1933",
      isModern: state.era === "modern",
      gap: state.gap,
      maxGap: state.maxGap,
      gapPercent: Math.round((state.gap / state.maxGap) * 100),
      caught: state.gap <= 0,
      escaped: state.gap >= state.maxGap,
      pursuers: state.participants.filter((p) => p.role === "pursuer").map(decorate),
      quarries: state.participants.filter((p) => p.role === "quarry").map(decorate),
      skillSuggestions,
      log: state.log,
      hasLog: state.log.length > 0,
      ideas,
      ideasOpen: this.#ideasOpen,
      ...markers
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Formulaire d'ajout manuel (personnage ou véhicule)
    const addForm = this.element.querySelector(".coc7-chase-add-form");
    if (addForm) {
      addForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = addForm.querySelector(".coc7-chase-input-name").value;
        const role = addForm.querySelector(".coc7-chase-input-role").value;
        const move = addForm.querySelector(".coc7-chase-input-move").value;
        const kind = addForm.querySelector(".coc7-chase-input-kind").value;
        await addParticipant({ name, role, move, kind });
        addForm.reset();
      });
    }

    // Cartes participant : glissables pour changer de colonne
    this.element.querySelectorAll(".coc7-chase-participant").forEach((card) => {
      card.setAttribute("draggable", "true");
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData(DRAG_MIME, card.dataset.participantId);
        event.dataTransfer.effectAllowed = "move";
      });
    });

    // Colonnes : cibles de dépôt (acteurs Foundry OU cartes participant)
    this.element.querySelectorAll(".coc7-chase-column-body").forEach((zone) => {
      const role = zone.dataset.role;

      zone.addEventListener("dragenter", (event) => {
        event.preventDefault();
      });
      zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        zone.classList.add("coc7-chase-dragover");
      });
      zone.addEventListener("dragleave", () => {
        zone.classList.remove("coc7-chase-dragover");
      });
      zone.addEventListener("drop", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        zone.classList.remove("coc7-chase-dragover");

        // Cas 1 : on déplace une carte participant déjà présente dans le tableau.
        const internalId = event.dataTransfer.getData(DRAG_MIME);
        if (internalId) {
          await setParticipantRole(internalId, role);
          return;
        }

        // Cas 2 : on dépose un acteur depuis la barre latérale Foundry.
        let data;
        try {
          const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
          data = TE.getDragEventData(event);
        } catch (err) {
          data = null;
        }
        if (!data?.type) {
          // Filet de sécurité si getDragEventData ne renvoie rien d'exploitable.
          try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
          } catch (err) {
            data = null;
          }
        }

        if ((data?.type === "Actor" || data?.type === "Item") && data.uuid) {
          const doc = await fromUuid(data.uuid);
          if (doc) {
            await addParticipantFromDocument(doc, role);
            ui.notifications?.info(`${doc.name} ajouté à la poursuite.`);
          } else {
            ui.notifications?.warn("Élément introuvable pour cet objet déposé.");
          }
        } else {
          ui.notifications?.warn("Seuls les acteurs et objets (ex. fiches de véhicule) peuvent être déposés ici.");
        }
      });
    });

    // Emplacement "Conducteur" sur les cartes véhicule : accepte un Acteur
    this.element.querySelectorAll(".coc7-chase-driver-slot").forEach((slot) => {
      slot.addEventListener("dragenter", (event) => event.preventDefault());
      slot.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        slot.classList.add("coc7-chase-dragover");
      });
      slot.addEventListener("dragleave", () => {
        slot.classList.remove("coc7-chase-dragover");
      });
      slot.addEventListener("drop", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        slot.classList.remove("coc7-chase-dragover");

        let data;
        try {
          const TE = foundry.applications?.ux?.TextEditor?.implementation ?? TextEditor;
          data = TE.getDragEventData(event);
        } catch (err) {
          data = null;
        }
        if (!data?.type) {
          try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
          } catch (err) {
            data = null;
          }
        }

        if (data?.type === "Actor" && data.uuid) {
          const actor = await fromUuid(data.uuid);
          const card = slot.closest(".coc7-chase-participant");
          if (actor && card) {
            await setDriver(card.dataset.participantId, actor.id);
            ui.notifications?.info(`${actor.name} assigné comme conducteur.`);
          }
        } else {
          ui.notifications?.warn("Seul un acteur (personnage/PNJ) peut être assigné comme conducteur.");
        }
      });
    });
  }

  static async onSetModeFoot() { await setMode("foot"); }
  static async onSetModeCar() { await setMode("car"); }
  static async onSetEra1933() { await setEra("1933"); }
  static async onSetEraModern() { await setEra("modern"); }
  static async onGapMinus() { await adjustGap(-1); }
  static async onGapPlus() { await adjustGap(1); }

  static async onDeleteParticipant(_event, target) {
    await deleteParticipant(target.dataset.participantId);
  }

  static async onObstacleSuccess(_event, target) {
    await ChaseTrackerApp.#resolveObstacle(target, true);
  }

  static async onObstacleFailure(_event, target) {
    await ChaseTrackerApp.#resolveObstacle(target, false);
  }

  static async #resolveObstacle(target, success) {
    const row = target.closest(".coc7-chase-participant");
    if (!row) return;
    const participantId = row.dataset.participantId;
    const skillInput = row.querySelector(".coc7-chase-obstacle-skill");
    const severitySelect = row.querySelector(".coc7-chase-obstacle-severity");
    const skill = skillInput?.value?.trim() || "Chance";
    const severity = severitySelect?.value || "minor";
    await recordObstacle(participantId, skill, severity, success);
  }

  static async onRollChance(_event, target) {
    const row = target.closest(".coc7-chase-participant");
    if (!row) return;
    const severitySelect = row.querySelector(".coc7-chase-obstacle-severity");
    const severity = severitySelect?.value || "minor";
    await rollChanceForParticipant(row.dataset.participantId, severity);
  }

  static async onResetChase() { await resetChase(); }
  static async onClearAll() { await clearAll(); }

  static async onDeleteDriver(_event, target) {
    const card = target.closest(".coc7-chase-participant");
    if (!card) return;
    await removeDriver(card.dataset.participantId);
  }

  static onToggleIdeas() {
    this.#ideasOpen = !this.#ideasOpen;
    this.render();
  }
}

/* ------------------------------------------------------------------ */
/*  Instance unique + bascule ouverture/fermeture                      */
/* ------------------------------------------------------------------ */
let appInstance = null;
let gaugeAppInstance = null;

function toggleChaseTracker() {
  if (appInstance?.rendered) {
    appInstance.close();
    return;
  }
  appInstance = new ChaseTrackerApp();
  appInstance.render({ force: true });
}

function toggleChaseGauge() {
  if (gaugeAppInstance?.rendered) {
    gaugeAppInstance.close();
    return;
  }
  gaugeAppInstance = new ChaseGaugeApp();
  gaugeAppInstance.render({ force: true });
}

Hooks.on("updateSetting", (setting) => {
  if (setting.key !== `${MODULE_ID}.${SETTING_KEY}`) return;
  if (appInstance?.rendered) appInstance.render();
  if (gaugeAppInstance?.rendered) gaugeAppInstance.render();
});

/* ------------------------------------------------------------------ */
/*  Bouton dans la barre de contrôles de scène (barre latérale gauche) */
/* ------------------------------------------------------------------ */
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControl = controls.tokens;
  if (!tokenControl?.tools) return;

  tokenControl.tools.chaseTracker = {
    name: "chaseTracker",
    title: "COC7CHASE.ButtonTitle",
    icon: "fa-solid fa-gauge-high",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => toggleChaseTracker()
  };

  tokenControl.tools.chaseGauge = {
    name: "chaseGauge",
    title: "COC7CHASE.GaugeButtonTitle",
    icon: "fa-solid fa-gauge-simple-high",
    order: Object.keys(tokenControl.tools).length,
    button: true,
    visible: true,
    onChange: () => toggleChaseGauge()
  };
});
