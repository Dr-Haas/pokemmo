const fs = require("fs");
const path = require("path");
const { Molroo } = require("@molroo-io/sdk");
const { validateNpcPlacements } = require("./mapSpawnValidator");

let createOpenAI;
try {
    ({ createOpenAI } = require("@ai-sdk/openai"));
} catch (error) {
    createOpenAI = null;
}

const CACHE_FILE = path.join(__dirname, "..", ".molroo-npc-cache.json");
const WORLD_NAME = "PokeMMO Echo Town";
const WORLD_DESCRIPTION = "A retro Pokemon-style town mystery where five emotionally aware NPCs react to the player's choices.";

const NEUTRAL_EMOTION = {
    label: "neutral",
    intensity: 0.18,
    vad: { V: 0, A: 0, D: 0 }
};

const CHOICES = {
    TALK: { id: "TALK", label: "PARLER" },
    LISTEN: { id: "LISTEN", label: "ÉCOUTER" },
    ASK: { id: "ASK", label: "QUESTIONNER" },
    SHARE: { id: "SHARE", label: "DONNER INDICE" },
    PRESS: { id: "PRESS", label: "INSISTER" },
    REUNITE: { id: "REUNITE", label: "RÉUNIR LE BOURG" },
    GOODBYE: { id: "GOODBYE", label: "AU REVOIR" }
};

const ACTION_APPRAISALS = [
    {
        name: "greet",
        description: "A warm greeting that invites conversation.",
        appraisalVector: {
            goalRelevance: 0.6,
            goalCongruence: 0.6,
            expectedness: 0.6,
            controllability: 0.7,
            agency: 0.3,
            normCompatibility: 0.8,
            internalStandards: 0.7,
            adjustmentPotential: 0.8,
            urgency: 0.2
        }
    },
    {
        name: "comfort",
        description: "A careful, empathic response meant to calm someone down.",
        appraisalVector: {
            goalRelevance: 0.8,
            goalCongruence: 0.9,
            expectedness: 0.7,
            controllability: 0.7,
            agency: 0.2,
            normCompatibility: 0.9,
            internalStandards: 0.9,
            adjustmentPotential: 0.8,
            urgency: 0.3
        }
    },
    {
        name: "ask_for_help",
        description: "A request for information or cooperation.",
        appraisalVector: {
            goalRelevance: 0.9,
            goalCongruence: 0.5,
            expectedness: 0.5,
            controllability: 0.5,
            agency: 0.4,
            normCompatibility: 0.8,
            internalStandards: 0.6,
            adjustmentPotential: 0.6,
            urgency: 0.5
        }
    },
    {
        name: "share_clue",
        description: "The player shares a discovery that changes the conversation.",
        appraisalVector: {
            goalRelevance: 0.9,
            goalCongruence: 0.8,
            expectedness: 0.4,
            controllability: 0.6,
            agency: 0.4,
            normCompatibility: 0.9,
            internalStandards: 0.8,
            adjustmentPotential: 0.8,
            urgency: 0.5
        }
    },
    {
        name: "accuse",
        description: "A confrontational accusation that raises tension.",
        appraisalVector: {
            goalRelevance: 0.9,
            goalCongruence: 0.2,
            expectedness: 0.4,
            controllability: 0.3,
            agency: 0.8,
            normCompatibility: 0.3,
            internalStandards: 0.4,
            adjustmentPotential: 0.4,
            urgency: 0.8
        }
    },
    {
        name: "reunite_town",
        description: "A hopeful invitation to bring everyone together and resolve the mystery.",
        appraisalVector: {
            goalRelevance: 1,
            goalCongruence: 1,
            expectedness: 0.6,
            controllability: 0.7,
            agency: 0.5,
            normCompatibility: 1,
            internalStandards: 1,
            adjustmentPotential: 1,
            urgency: 0.6
        }
    }
];

const NPC_DEFINITIONS = [
    {
        id: "lyra",
        name: "Lyra",
        title: "Infirmière du bourg",
        map: "town",
        x: 318,
        y: 1186,
        spriteKey: "players",
        spriteFrame: "nurse_front.png",
        clueId: "sleep_hum",
        clueTitle: "Fredonnement",
        clueText: "Lyra a entendu Sol fredonner en dormant, à propos d'une porte qui chante au clair de lune.",
        shareNeed: 0,
        revealThreshold: 2,
        pressThreshold: 3,
        speakingStyle: "Douce, posée et chaleureuse. Parle comme quelqu'un qui apaise une pièce en pleine crise.",
        description: "L'infirmière qui garde le Bourg Écho calme, mais qui porte seule l'inquiétude de tout le monde.",
        personality: { O: 0.71, C: 0.84, E: 0.52, A: 0.89, N: 0.46, H: 0.82 },
        goals: [
            { id: "lyra-keep-calm", content: "Garder le bourg calme avant le lever de la lune.", priority: 0.92, mutable: true, status: "active" },
            { id: "lyra-protect-sol", content: "Protéger Sol des étranges murmures de la Lanterne.", priority: 0.88, mutable: true, status: "active" }
        ],
        opening: "Lyra plie une serviette avec soin. \"Tout le bourg retient son souffle ce soir.\"",
        support: "Les épaules de Lyra se détendent. \"Merci. Tout le monde vient me voir effrayé, et j'avais oublié que j'avais le droit d'avoir peur moi aussi.\"",
        guarded: "\"Je veux t'aider, mais je ne peux pas semer la panique dans le bourg. Gagne d'abord un peu ma confiance.\"",
        pressure: "\"S'il te plaît, n'en fais pas une chasse à l'homme. Sol a déjà assez peur.\"",
        completion: "\"Tu entends ? La lanterne ressemble enfin de nouveau à une berceuse.\""
    },
    {
        id: "piper",
        name: "Piper",
        title: "Coursière",
        map: "town",
        x: 412,
        y: 1188,
        spriteKey: "players",
        spriteFrame: "femaletrainer_front.png",
        clueId: "ribbon_fence",
        clueTitle: "Ruban d'argent",
        clueText: "La sacoche de Piper s'est accrochée à la clôture ouest, et un ruban d'argent s'est déchiré juste à côté.",
        shareNeed: 0,
        revealThreshold: 2,
        pressThreshold: 2,
        speakingStyle: "Rapide, vive et agitée. Ses mots arrivent par rafales nerveuses.",
        description: "Une coursière qui cache sa nervosité derrière la vitesse et les blagues. Elle en a vu plus qu'elle ne l'admet au début.",
        personality: { O: 0.63, C: 0.62, E: 0.86, A: 0.67, N: 0.58, H: 0.7 },
        goals: [
            { id: "piper-save-festival", content: "Faire en sorte que la fête du bourg ait bien lieu.", priority: 0.9, mutable: true, status: "active" },
            { id: "piper-drop-guilt", content: "Arrêter de s'en vouloir d'avoir raté l'indice du ruban déchiré.", priority: 0.74, mutable: true, status: "active" }
        ],
        opening: "Piper sautille sur place. \"Si je m'arrête, je me mets à réfléchir. Mauvaise affaire, ce soir.\"",
        support: "\"Bon. On respire. Voilà. Je me souviens vraiment de ce que j'ai vu si j'arrête de courir dans ma tête.\"",
        guarded: "\"Je sais des choses, oui, mais je ne les lâche pas au vent sans savoir si tu es sérieux.\"",
        pressure: "\"Hé, doucement. Je me sens déjà assez coupable.\"",
        completion: "\"Toute la place se remet à parler. C'est mieux que le silence.\""
    },
    {
        id: "sable",
        name: "Sable",
        title: "Bricoleur",
        map: "town",
        x: 528,
        y: 1182,
        spriteKey: "players",
        spriteFrame: "boss_front.png",
        clueId: "crate_confession",
        clueTitle: "Aveu de la caisse",
        clueText: "Sable a caché la Lanterne Écho dans une caisse sur la route, parce que ses murmures effrayaient Sol.",
        shareNeed: 2,
        revealThreshold: 4,
        pressThreshold: 2,
        speakingStyle: "Voix basse, phrases courtes, sur la défensive, mais étonnamment sincère quand on le coince avec gentillesse.",
        description: "Un mécanicien protecteur par instinct, même quand ses choix paraissent suspects.",
        personality: { O: 0.59, C: 0.81, E: 0.33, A: 0.48, N: 0.52, H: 0.76 },
        goals: [
            { id: "sable-protect-kids", content: "Tenir les choses dangereuses loin des enfants effrayés.", priority: 0.95, mutable: true, status: "active" },
            { id: "sable-avoid-villain", content: "Éviter d'être traité comme le méchant du bourg.", priority: 0.79, mutable: true, status: "active" }
        ],
        opening: "Sable garde une main sur sa clé à molette. \"Les gens crient fort quand ils ne comprennent pas une machine.\"",
        support: "\"...Tu es vraiment venu m'écouter ? D'accord. C'est plus rare que ça ne devrait l'être.\"",
        guarded: "\"Je ne dis rien. Pas tant que tu ne m'apportes pas du concret.\"",
        pressure: "\"Insiste encore et je me ferme. C'est aussi simple que ça.\"",
        completion: "\"La prochaine fois, je dirai peut-être la vérité avant de construire une cachette.\""
    },
    {
        id: "orin",
        name: "Orin",
        title: "Astronome",
        map: "town",
        x: 176,
        y: 1054,
        spriteKey: "players",
        spriteFrame: "professor_right_walk.002.png",
        clueId: "moon_chorus",
        clueTitle: "Choeur lunaire",
        clueText: "Orin explique que la Lanterne reflète la peur : si le bourg se rassemble dans le calme, elle chantera au lieu de murmurer.",
        shareNeed: 1,
        revealThreshold: 2,
        pressThreshold: 5,
        speakingStyle: "Mesuré, poétique et précis. On dirait qu'il pense en constellations.",
        description: "Le gardien de l'observatoire, qui comprend la Lanterne Écho mieux que personne mais se reproche ses effets.",
        personality: { O: 0.94, C: 0.76, E: 0.42, A: 0.74, N: 0.38, H: 0.84 },
        goals: [
            { id: "orin-repair-trust", content: "Rétablir la confiance du bourg avant le lever de la lune.", priority: 0.97, mutable: true, status: "active" },
            { id: "orin-turn-fear", content: "Changer la peur en émerveillement quand la Lanterne sera rendue.", priority: 0.94, mutable: true, status: "active" }
        ],
        opening: "Orin observe le ciel. \"Chaque mystère n'est qu'un sentiment qui attend assez de témoins.\"",
        support: "\"Alors peut-être que cette nuit peut encore devenir un choeur plutôt qu'un avertissement.\"",
        guarded: "\"Les motifs d'abord. Les conclusions ensuite.\"",
        pressure: "\"L'urgence sans clarté n'est qu'une tempête de plus.\"",
        completion: "\"Écoute bien. La Lanterne répond enfin à l'espoir plutôt qu'à la peur.\""
    },
    {
        id: "bram",
        name: "Bram",
        title: "Garde de la route",
        map: "route1",
        x: 418,
        y: 118,
        spriteKey: "players",
        spriteFrame: "knight_back_walk.002.png",
        clueId: "route_dust",
        clueTitle: "Poussière d'étoile",
        clueText: "Bram a trouvé de la poussière argentée et une caisse qui bourdonne sur la Route 1, juste après la barrière.",
        shareNeed: 0,
        revealThreshold: 2,
        pressThreshold: 2,
        speakingStyle: "Terre à terre, sobre, direct. Il parle peu, mais ce qu'il dit compte.",
        description: "Le garde de la route, qui remarque les détails et déteste la panique plus que le danger.",
        personality: { O: 0.45, C: 0.88, E: 0.37, A: 0.66, N: 0.34, H: 0.79 },
        goals: [
            { id: "bram-safe-road", content: "Garder la route sûre sans nourrir les rumeurs.", priority: 0.93, mutable: true, status: "active" },
            { id: "bram-guide-player", content: "Guider le joueur vers la vraie piste, pas vers le suspect le plus bruyant.", priority: 0.81, mutable: true, status: "active" }
        ],
        opening: "Bram scrute la route. \"Les traces ne mentent pas. Les gens, si.\"",
        support: "\"Bien. Enfin quelqu'un qui regarde le sol plutôt que les ragots.\"",
        guarded: "\"Tu veux des faits ? Arme-toi de patience.\"",
        pressure: "\"Mauvaise façon de demander de l'aide. Recommence.\"",
        completion: "\"Le bourg sonne déjà différemment. Moins de peur dans l'air.\""
    },
    {
        id: "mirelle",
        name: "Mirelle",
        title: "Infirmière d'Ashveld",
        map: "ashveld",
        x: 432,
        y: 414,
        spriteKey: "players",
        spriteFrame: "nurse_front.png",
        clueId: "ashveld-heartbeat",
        clueTitle: "Pouls d'Ashveld",
        clueText: "Mirelle garde Ashveld stable en écoutant ce que les gens refusent de dire tout haut.",
        shareNeed: 99,
        revealThreshold: 99,
        pressThreshold: 99,
        speakingStyle: "Parle doucement, observatrice et réconfortante sans paraître distante.",
        description: "L'infirmière du Centre Pokémon d'Ashveld, qui remarque le stress avant que quiconque ne le nomme.",
        personality: { O: 0.62, C: 0.91, E: 0.41, A: 0.92, N: 0.34, H: 0.86 },
        goals: [
            { id: "mirelle-keep-town-rested", content: "Empêcher Ashveld de sombrer dans l'inquiétude et la fatigue.", priority: 0.89, mutable: true, status: "active" }
        ],
        opening: "Mirelle plie une couverture. \"Ashveld a le sommeil léger. Ici, on entend chaque rumeur deux fois.\"",
        support: "\"C'est mieux. Les voix calmes portent plus loin que la panique.\"",
        guarded: "\"Les questions, ça va. Je ne ferai juste pas du centre une usine à rumeurs.\"",
        pressure: "\"C'est un endroit pour se reposer, pas pour coincer les gens.\"",
        completion: "\"Même le coeur de la ville bat plus calmement ce soir.\""
    },
    {
        id: "tavi",
        name: "Tavi",
        title: "Marchand d'Ashveld",
        map: "ashveld",
        x: 706,
        y: 446,
        spriteKey: "players",
        spriteFrame: "tuxemartemployee_front.png",
        clueId: "ashveld-ledger",
        clueTitle: "Registre d'Ashveld",
        clueText: "Tavi suit l'humeur de la ville d'après ce qui disparaît des rayons avant les tempêtes.",
        shareNeed: 99,
        revealThreshold: 99,
        pressThreshold: 99,
        speakingStyle: "Rapide, pratique et un peu théâtral quand la boutique est calme.",
        description: "Le vendeur de la Boutique Pokémon d'Ashveld, à la fois filtre à ragots et machine logistique.",
        personality: { O: 0.58, C: 0.87, E: 0.71, A: 0.68, N: 0.29, H: 0.77 },
        goals: [
            { id: "tavi-keep-stock-moving", content: "Garder les marchandises en circulation, même quand les routes semblent étranges.", priority: 0.82, mutable: true, status: "active" }
        ],
        opening: "Tavi tapote un registre. \"Quand la peur monte, les Antidotes et les cordes partent en premier. Les villes se trahissent toujours.\"",
        support: "\"Voilà. Une conversation sensée. Bien moins chère qu'une panique.\"",
        guarded: "\"Tu auras une réponse plus claire si tu arrêtes de me poser des questions comme un contrôleur.\"",
        pressure: "\"Insiste encore et je commence à facturer la consultation.\"",
        completion: "\"Le commerce a repris. C'est comme ça qu'on sait qu'une ville a pardonné la journée.\""
    },
    {
        id: "rowan",
        name: "Rowan",
        title: "Gardien d'Ashveld",
        map: "ashveld",
        x: 678,
        y: 832,
        spriteKey: "players",
        spriteFrame: "professor_front.png",
        clueId: "ashveld-bells",
        clueTitle: "Cloches d'Ashveld",
        clueText: "Rowan cale ses rondes sur les vieilles cloches, parce que le silence inquiète la place.",
        shareNeed: 99,
        revealThreshold: 99,
        pressThreshold: 99,
        speakingStyle: "Mesuré et réfléchi, avec la patience de quelqu'un qui travaille parmi les vieilles choses.",
        description: "Le gardien du mémorial d'Ashveld, plus soucieux de préserver le calme que d'offrir un spectacle.",
        personality: { O: 0.81, C: 0.79, E: 0.36, A: 0.84, N: 0.27, H: 0.88 },
        goals: [
            { id: "rowan-keep-square-calm", content: "Garder la place du mémorial paisible au passage des voyageurs.", priority: 0.9, mutable: true, status: "active" }
        ],
        opening: "Rowan observe la place. \"Une ville respire dans ses silences. Ashveld a appris à ne pas les craindre.\"",
        support: "\"Tu l'as remarqué aussi. La plupart des gens n'entendent que le bruit, pas le rythme.\"",
        guarded: "\"Les questions ne me dérangent pas. Les questions maladroites, si.\"",
        pressure: "\"La pression abîme la vieille pierre autant que les bonnes conversations.\"",
        completion: "\"Les cloches sonnent plus légères quand les gens cessent de craindre le pire.\""
    },
    {
        id: "selene",
        name: "Selene",
        title: "Guide d'Arène",
        map: "crysthaven",
        x: 1232,
        y: 574,
        spriteKey: "players",
        spriteFrame: "girl1_front.png",
        clueId: "crysthaven-gymlight",
        clueTitle: "Lumière de l'Arène",
        clueText: "Selene dit que la lueur de l'Arène est la façon dont Crysthaven refuse de s'éteindre.",
        shareNeed: 99,
        revealThreshold: 99,
        pressThreshold: 99,
        speakingStyle: "Vive, sûre d'elle et encourageante, comme quelqu'un qui a l'habitude d'accueillir les challengers.",
        description: "Une guide d'Arène qui voit la confiance comme une chose qu'on peut emprunter jusqu'à ce qu'elle devienne la sienne.",
        personality: { O: 0.69, C: 0.74, E: 0.83, A: 0.81, N: 0.22, H: 0.75 },
        goals: [
            { id: "selene-keep-city-brave", content: "Garder Crysthaven audacieuse et vivante pour les nouveaux venus.", priority: 0.85, mutable: true, status: "active" }
        ],
        opening: "Selene sourit en regardant l'Arène. \"Crysthaven aime que ses défis se voient. Ici, on ne fuit pas le progrès.\"",
        support: "\"Exactement. Le trac, c'est juste du courage pas encore utilisé.\"",
        guarded: "\"Je peux t'aider, mais pas si tu cherches un raccourci dans chaque réponse.\"",
        pressure: "\"Avec cette attitude, tu n'iras pas loin, ni dans une Arène ni en ville.\"",
        completion: "\"Voilà le rythme de Crysthaven que j'aime.\""
    },
    {
        id: "corin",
        name: "Corin",
        title: "Pêcheur du canal",
        map: "crysthaven",
        x: 594,
        y: 702,
        spriteKey: "players",
        spriteFrame: "knight_front.png",
        clueId: "crysthaven-current",
        clueTitle: "Courant de la ville",
        clueText: "Corin mesure la ville comme le courant : la foule et l'eau dérivent là où il y a de la place.",
        shareNeed: 99,
        revealThreshold: 99,
        pressThreshold: 99,
        speakingStyle: "Franc, buriné et étonnamment philosophe par courtes phrases.",
        description: "Un pêcheur qui comprend le courant, la patience, et l'intérêt de rester immobile assez longtemps pour voir les choses changer.",
        personality: { O: 0.54, C: 0.8, E: 0.31, A: 0.72, N: 0.21, H: 0.83 },
        goals: [
            { id: "corin-watch-currents", content: "Lire l'humeur de la ville comme il lit l'eau.", priority: 0.79, mutable: true, status: "active" }
        ],
        opening: "Corin plisse les yeux vers la rue. \"Les villes ont des courants aussi. Reste immobile et tu sentiras de quel côté penchent les gens.\"",
        support: "\"Bien. Pas besoin d'éclabousser pour qu'une réponse compte.\"",
        guarded: "\"Tu en entendras plus si tu arrêtes de tirer sur la ligne.\"",
        pressure: "\"Tire trop vite et la prise se décroche.\"",
        completion: "\"Eau calme, rues calmes. Ça me suffit.\""
    },
    {
        id: "mara",
        name: "Mara",
        title: "Architecte",
        map: "crysthaven",
        x: 530,
        y: 1076,
        spriteKey: "players",
        spriteFrame: "omnichannelceo_front.png",
        clueId: "crysthaven-blueprint",
        clueTitle: "Plan de la ville",
        clueText: "Mara dit que chaque quartier a besoin d'un lieu pour se rassembler et d'un lieu pour respirer.",
        shareNeed: 99,
        revealThreshold: 99,
        pressThreshold: 99,
        speakingStyle: "Précise, élégante et discrètement exigeante en matière de cohérence.",
        description: "La planificatrice derrière le plan de Crysthaven, qui pense toujours en avenues, en perspectives et en ambiances.",
        personality: { O: 0.88, C: 0.9, E: 0.49, A: 0.63, N: 0.19, H: 0.8 },
        goals: [
            { id: "mara-protect-layout", content: "Garder Crysthaven bien structurée sans la rendre froide.", priority: 0.91, mutable: true, status: "active" }
        ],
        opening: "Mara étudie l'avenue. \"Une bonne ville guide les gens sans qu'ils se sentent manipulés.\"",
        support: "\"Oui. L'architecture, c'est de l'empathie qui a appris la géométrie.\"",
        guarded: "\"Une question utile mérite une réponse précise. Une question impatiente, non.\"",
        pressure: "\"Si tu veux de la clarté, arrête de confondre la force et la direction.\"",
        completion: "\"Tout le boulevard se lit mieux quand les gens portent moins de tension.\""
    },
    {
        id: "jules",
        name: "Jules",
        title: "Coursier du marché",
        map: "crysthaven",
        x: 1090,
        y: 1110,
        spriteKey: "players",
        spriteFrame: "red_front.png",
        clueId: "crysthaven-post",
        clueTitle: "Courrier du marché",
        clueText: "Jules connaît chaque raccourci de Crysthaven et la moitié des histoires qui vont avec.",
        shareNeed: 99,
        revealThreshold: 99,
        pressThreshold: 99,
        speakingStyle: "Énergique, joueur, et toujours à deux doigts de filer vers la course suivante.",
        description: "Un coursier qui transforme les longues avenues de la ville en terrain de jeu.",
        personality: { O: 0.73, C: 0.64, E: 0.91, A: 0.7, N: 0.24, H: 0.68 },
        goals: [
            { id: "jules-keep-city-moving", content: "Garder les marchés et les messages en mouvement, sans embouteillage.", priority: 0.84, mutable: true, status: "active" }
        ],
        opening: "Jules sautille sur place. \"Si je m'arrête, Crysthaven paraît deux fois plus grande. Alors je ne m'arrête pas.\"",
        support: "\"Voilà. Tu as compris la ville. Suis le rythme, ne lutte pas contre.\"",
        guarded: "\"Je peux répondre, mais pas si tu essaies de sprinter à travers la conversation.\"",
        pressure: "\"Trop de pression et je disparais dans la ruelle suivante.\"",
        completion: "\"La ville est de nouveau sur pied. Rapide, lumineuse, insaisissable.\""
    }
];

const RESOLVED_NPC_DEFINITIONS = validateNpcPlacements(NPC_DEFINITIONS);

class NpcEmotionService {
    constructor() {
        this.molroo = null;
        this.world = null;
        this.openaiProvider = null;
        this.cache = { worldId: null, personas: {} };
        this.initPromise = null;
        this.playerStates = new Map();
        this.npcState = new Map(RESOLVED_NPC_DEFINITIONS.map((npc) => [npc.id, {
            ...npc,
            emotion: { ...NEUTRAL_EMOTION },
            molrooPersonaId: null,
            worldPersonaId: null
        }]));
    }

    async init() {
        if (!this.initPromise) {
            this.initPromise = this.initialize().catch((error) => {
                this.initPromise = null;
                console.warn("NPC emotion service init failed", error);
            });
        }

        return this.initPromise;
    }

    async initialize() {
        this.cache = this.readCache();
        const molrooApiKey = process.env.MOLROO_API_KEY;
        if (!molrooApiKey) {
            return;
        }

        this.molroo = new Molroo({ apiKey: molrooApiKey });
        this.openaiProvider = this.createOpenAIProvider();
        this.world = await this.ensureWorld();
        await this.ensureActions();
        await this.ensurePersonas();
    }

    createOpenAIProvider() {
        if (!createOpenAI || !process.env.OPENAI_API_KEY) {
            return null;
        }

        try {
            const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
            return openai("gpt-4o-mini");
        } catch (error) {
            console.warn("Unable to create OpenAI provider for Molroo", error);
            return null;
        }
    }

    async ensureWorld() {
        if (this.cache.worldId) {
            try {
                return await this.molroo.getWorld(this.cache.worldId);
            } catch (error) {
                console.warn("Cached Molroo world not found, recreating", error.message);
            }
        }

        const worlds = await this.molroo.listWorlds({ limit: 50 });
        const existingWorld = worlds.worlds.find((world) => world.name === WORLD_NAME);
        if (existingWorld) {
            this.cache.worldId = existingWorld.id;
            this.writeCache();
            return await this.molroo.getWorld(existingWorld.id);
        }

        const world = await this.molroo.createWorld({
            name: WORLD_NAME,
            description: WORLD_DESCRIPTION,
            accessPolicy: "closed",
            responseRule: "target"
        });

        this.cache.worldId = world.id;
        this.writeCache();
        return world;
    }

    async ensureActions() {
        if (!this.world) {
            return;
        }

        const existingActions = await this.world.listActions();
        const actionNames = new Set(existingActions.map((action) => action.name));

        for (const action of ACTION_APPRAISALS) {
            if (actionNames.has(action.name)) {
                continue;
            }

            await this.world.createAction(action);
        }
    }

    async ensurePersonas() {
        if (!this.world) {
            return;
        }

        const worldPersonas = await this.world.listPersonas();
        const personaSummaries = await this.molroo.listPersonas();

        for (const definition of RESOLVED_NPC_DEFINITIONS) {
            const cachedPersona = this.cache.personas[definition.id] || {};
            let standalonePersonaId = cachedPersona.personaId || null;
            let worldPersonaId = cachedPersona.worldPersonaId || null;

            const existingWorldPersona = worldPersonas.find((persona) => {
                const displayName = getRawValue(persona, "displayName", "display_name");
                return displayName === definition.name;
            });

            if (existingWorldPersona) {
                worldPersonaId = getRawValue(existingWorldPersona, "id");
                standalonePersonaId = standalonePersonaId || getRawValue(existingWorldPersona, "personaConfigId", "persona_config_id");
            }

            if (!standalonePersonaId) {
                const matchingStandalone = personaSummaries.personas.find((persona) => {
                    const identity = persona.config?.identity || {};
                    return identity.extensions?.pokemmoNpcId === definition.id;
                });

                if (matchingStandalone) {
                    standalonePersonaId = matchingStandalone.id;
                }
            }

            if (!standalonePersonaId) {
                const persona = await this.molroo.createPersona({
                    identity: {
                        name: definition.name,
                        role: definition.title,
                        speakingStyle: definition.speakingStyle,
                        description: definition.description,
                        extensions: {
                            pokemmoNpcId: definition.id,
                            map: definition.map
                        }
                    },
                    personality: definition.personality,
                    goals: definition.goals
                });

                standalonePersonaId = persona.id;
            }

            if (!worldPersonaId) {
                const worldPersonaRef = await this.world.addPersona({
                    personaId: standalonePersonaId,
                    displayName: definition.name
                });
                worldPersonaId = worldPersonaRef.id;
            }

            this.cache.personas[definition.id] = {
                personaId: standalonePersonaId,
                worldPersonaId
            };
            this.writeCache();

            const npcState = this.npcState.get(definition.id);
            npcState.molrooPersonaId = standalonePersonaId;
            npcState.worldPersonaId = worldPersonaId;
        }
    }

    readCache() {
        try {
            if (!fs.existsSync(CACHE_FILE)) {
                return { worldId: null, personas: {} };
            }

            return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
        } catch (error) {
            console.warn("Unable to read Molroo NPC cache", error);
            return { worldId: null, personas: {} };
        }
    }

    writeCache() {
        try {
            fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2));
        } catch (error) {
            console.warn("Unable to write Molroo NPC cache", error);
        }
    }

    getPlayerState(playerId) {
        if (!this.playerStates.has(playerId)) {
            this.playerStates.set(playerId, {
                trust: {},
                clues: [],
                histories: {},
                flags: {
                    finaleUnlocked: false,
                    storyComplete: false
                }
            });
        }

        const playerState = this.playerStates.get(playerId);
        for (const npc of RESOLVED_NPC_DEFINITIONS) {
            if (typeof playerState.trust[npc.id] !== "number") {
                playerState.trust[npc.id] = 0;
            }

            if (!Array.isArray(playerState.histories[npc.id])) {
                playerState.histories[npc.id] = [];
            }
        }

        return playerState;
    }

    async listNpcs(playerId, mapName) {
        await this.init();
        const playerState = this.getPlayerState(playerId);

        return {
            npcs: RESOLVED_NPC_DEFINITIONS
                .filter((npc) => !mapName || npc.map === mapName)
                .map((npc) => this.serializeNpc(npc.id, playerState)),
            story: this.serializeStory(playerState)
        };
    }

    async interact(playerId, npcId, choiceId) {
        await this.init();

        const npc = this.npcState.get(npcId);
        if (!npc) {
            throw new Error(`Unknown NPC: ${npcId}`);
        }

        const playerState = this.getPlayerState(playerId);
        const resolvedChoice = CHOICES[choiceId] ? choiceId : "TALK";
        const outcome = this.resolveStoryBeat(playerState, npc, resolvedChoice);
        const result = await this.generateResponse(playerId, playerState, npc, outcome);

        return {
            npc: this.serializeNpc(npc.id, playerState),
            response: result,
            story: this.serializeStory(playerState)
        };
    }

    serializeNpc(npcId, playerState) {
        const npc = this.npcState.get(npcId);
        return {
            id: npc.id,
            name: npc.name,
            title: npc.title,
            map: npc.map,
            x: npc.x,
            y: npc.y,
            spriteKey: npc.spriteKey,
            spriteFrame: npc.spriteFrame,
            emotion: npc.emotion || NEUTRAL_EMOTION,
            trust: playerState.trust[npc.id] || 0,
            availableChoices: this.getChoicesForNpc(playerState, npc)
        };
    }

    serializeStory(playerState) {
        return {
            clueCount: playerState.clues.length,
            clues: playerState.clues.map((clueId) => {
                const owner = RESOLVED_NPC_DEFINITIONS.find((npc) => npc.clueId === clueId);
                return {
                    id: clueId,
                    title: owner?.clueTitle || clueId,
                    text: owner?.clueText || clueId
                };
            }),
            finaleUnlocked: playerState.flags.finaleUnlocked,
            storyComplete: playerState.flags.storyComplete
        };
    }

    getChoicesForNpc(playerState, npc) {
        const choices = [
            CHOICES.TALK,
            CHOICES.LISTEN,
            CHOICES.ASK
        ];

        if (playerState.clues.length > 0) {
            choices.push(CHOICES.SHARE);
        }

        choices.push(CHOICES.PRESS);

        if (npc.id === "orin" && playerState.flags.finaleUnlocked && !playerState.flags.storyComplete) {
            choices.push(CHOICES.REUNITE);
        }

        choices.push(CHOICES.GOODBYE);
        return choices;
    }

    resolveStoryBeat(playerState, npc, choiceId) {
        const trustBefore = playerState.trust[npc.id] || 0;
        let trustDelta = 0;
        let unlockedClue = null;
        let specialHint = "";
        let actionName = "greet";
        let tone = "neutral";

        if (playerState.flags.storyComplete) {
            return {
                choiceId,
                actionName: "greet",
                tone: "calm",
                trustDelta: 0,
                unlockedClue: null,
                specialHint: npc.completion,
                isGuarded: false
            };
        }

        switch (choiceId) {
        case "TALK":
            trustDelta = trustBefore === 0 ? 1 : 0;
            specialHint = npc.opening;
            actionName = "greet";
            tone = "warm";
            break;
        case "LISTEN":
            trustDelta = 2;
            specialHint = npc.support;
            actionName = "comfort";
            tone = "comfort";
            break;
        case "ASK":
            trustDelta = 1;
            actionName = "ask_for_help";
            if (trustBefore + trustDelta >= npc.revealThreshold) {
                unlockedClue = this.unlockClue(playerState, npc.clueId);
                specialHint = unlockedClue ? npc.clueText : `"Tu as déjà entendu l'essentiel", dit ${npc.name}.`;
                tone = unlockedClue ? "reveal" : "repeat";
            } else {
                specialHint = npc.guarded;
                tone = "guarded";
            }
            break;
        case "SHARE":
            trustDelta = 2;
            actionName = "share_clue";
            if (playerState.clues.length >= npc.shareNeed) {
                unlockedClue = this.unlockClue(playerState, npc.clueId);
                specialHint = unlockedClue ? npc.clueText : `${npc.name} acquiesce. "Ça colle avec le reste."`;
                tone = unlockedClue ? "reveal" : "share";
            } else {
                specialHint = `"Apporte-moi mieux qu'une intuition", dit ${npc.name}.`;
                tone = "guarded";
            }
            break;
        case "PRESS":
            trustDelta = -1;
            actionName = "accuse";
            if (trustBefore >= npc.pressThreshold || playerState.clues.length >= Math.max(1, npc.shareNeed)) {
                unlockedClue = this.unlockClue(playerState, npc.clueId);
                specialHint = unlockedClue ? npc.clueText : npc.pressure;
                tone = unlockedClue ? "shaken_reveal" : "tense";
            } else {
                specialHint = npc.pressure;
                tone = "tense";
            }
            break;
        case "REUNITE":
            trustDelta = 1;
            actionName = "reunite_town";
            if (npc.id === "orin" && playerState.flags.finaleUnlocked) {
                playerState.flags.storyComplete = true;
                specialHint = "Orin sourit enfin. \"Réunis le bourg sur la place. Des voix calmes changeront les murmures de la Lanterne en chant.\"";
                tone = "resolution";
            } else {
                specialHint = "\"Pas encore\", dit Orin. \"Le bourg a encore besoin de plus de vérité que d'espoir.\"";
                tone = "guarded";
            }
            break;
        case "GOODBYE":
            actionName = "greet";
            specialHint = `"À plus tard", dit ${npc.name}.`;
            tone = "farewell";
            break;
        default:
            specialHint = npc.opening;
        }

        playerState.trust[npc.id] = clamp(trustBefore + trustDelta, 0, 7);
        playerState.flags.finaleUnlocked = this.isFinaleUnlocked(playerState);

        return {
            choiceId,
            actionName,
            tone,
            trustDelta,
            unlockedClue,
            specialHint,
            isGuarded: tone === "guarded"
        };
    }

    unlockClue(playerState, clueId) {
        if (playerState.clues.includes(clueId)) {
            return null;
        }

        playerState.clues.push(clueId);
        return clueId;
    }

    isFinaleUnlocked(playerState) {
        return playerState.clues.includes("crate_confession") && playerState.clues.length >= 4;
    }

    async generateResponse(playerId, playerState, npc, outcome) {
        let emotion = npc.emotion || NEUTRAL_EMOTION;
        let text;

        if (this.world && npc.worldPersonaId) {
            try {
                const persona = this.world.persona(npc.worldPersonaId, this.openaiProvider ? { llm: this.openaiProvider } : undefined);
                if (this.openaiProvider) {
                    const history = playerState.histories[npc.id];
                    const prompt = this.buildAiPrompt(playerState, npc, outcome);
                    const result = await persona.react(outcome.actionName, {
                        actor: playerId,
                        actorType: "user",
                        prompt,
                        history
                    });

                    emotion = normalizeEmotion(result.emotion);
                    text = result.narrative;
                    history.push({ role: "user", content: prompt });
                    history.push({ role: "assistant", content: text });
                    if (history.length > 12) {
                        playerState.histories[npc.id] = history.slice(-12);
                    }
                } else {
                    const result = await persona.interact(outcome.actionName, {
                        actor: playerId,
                        actorType: "user",
                        stimulusDescription: this.buildAiPrompt(playerState, npc, outcome)
                    });
                    emotion = normalizeEmotion(result.emotion);
                    text = this.buildFallbackText(playerState, npc, outcome, emotion);
                }
            } catch (error) {
                console.warn(`Molroo interaction failed for ${npc.id}`, error.message);
                text = this.buildFallbackText(playerState, npc, outcome, emotion);
            }
        } else {
            emotion = this.createLocalEmotion(npc, outcome);
            text = this.buildFallbackText(playerState, npc, outcome, emotion);
        }

        npc.emotion = emotion;

        return {
            choiceId: outcome.choiceId,
            text,
            lines: wrapDialogue(text, 38, 4),
            emotion,
            unlockedClue: outcome.unlockedClue ? this.serializeStory(playerState).clues.find((clue) => clue.id === outcome.unlockedClue) : null,
            availableChoices: this.getChoicesForNpc(playerState, npc)
        };
    }

    buildAiPrompt(playerState, npc, outcome) {
        const clueSummary = playerState.clues.length
            ? playerState.clues.map((clueId) => {
                const owner = RESOLVED_NPC_DEFINITIONS.find((entry) => entry.clueId === clueId);
                return owner ? `${owner.clueTitle}: ${owner.clueText}` : clueId;
            }).join(" | ")
            : "Aucun indice pour l'instant.";

        return [
            `Tu es ${npc.name}, ${npc.title} au Bourg Écho.`,
            `Façon de parler : ${npc.speakingStyle}`,
            `Confiance actuelle envers le joueur : ${playerState.trust[npc.id]} / 7.`,
            "Contexte : la Lanterne Écho a disparu avant le lever de la lune. Le joueur rassemble des indices auprès des habitants.",
            `Indices connus : ${clueSummary}`,
            `Ton de l'échange : ${outcome.tone}.`,
            `Moment à jouer : ${outcome.specialHint}`,
            "Réponds toujours en français, tutoie le joueur.",
            "Réponds en 1 ou 2 courtes répliques de RPG japonais, moins de 50 mots au total.",
            "Ne mentionne jamais que tu es une IA, un moteur d'émotions ou un prompt système."
        ].join("\n");
    }

    buildFallbackText(playerState, npc, outcome, emotion) {
        const moodPrefix = getMoodPrefix(emotion.label);
        // When the clue is the beat itself, the client's "new clue" banner is enough.
        const clueLine = outcome.unlockedClue && outcome.specialHint !== npc.clueText
            ? `Nouvel indice : ${npc.clueText}`
            : "";
        const finaleLine = playerState.flags.storyComplete
            ? "La place devrait sembler différente maintenant."
            : playerState.flags.finaleUnlocked && npc.id === "orin"
                ? "Tu as assez d'indices. Demande à Orin de réunir le bourg."
                : "";

        const body = [outcome.specialHint, clueLine, finaleLine].filter(Boolean).join(" ");
        const intro = moodPrefix ? `${npc.name} ${moodPrefix}` : `${npc.name} répond avec prudence.`;
        // The dialogue box shows 4 lines of 38 characters: drop the mood line rather than cut the story.
        const withIntro = `${intro} ${body}`;
        return wrapDialogue(withIntro, 38, 5).length <= 4 ? withIntro : body;
    }

    createLocalEmotion(npc, outcome) {
        const labelByTone = {
            warm: "trust",
            comfort: "relief",
            reveal: "curiosity",
            shaken_reveal: "fear",
            resolution: "joy",
            tense: "anger",
            guarded: "neutral",
            farewell: "neutral",
            calm: "joy",
            repeat: "neutral",
            share: "curiosity"
        };

        const label = labelByTone[outcome.tone] || "neutral";
        return {
            label,
            intensity: 0.35,
            vad: {
                V: label === "anger" ? -0.2 : 0.35,
                A: label === "fear" || label === "anger" ? 0.55 : 0.18,
                D: npc.id === "sable" ? 0.2 : -0.1
            }
        };
    }
}

function getRawValue(source, ...keys) {
    if (!source) {
        return null;
    }

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            return source[key];
        }
    }

    return null;
}

function normalizeEmotion(emotion) {
    if (!emotion) {
        return { ...NEUTRAL_EMOTION };
    }

    return {
        label: emotion.label || emotion.discrete?.primary || "neutral",
        intensity: emotion.intensity ?? emotion.discrete?.intensity ?? 0.2,
        vad: emotion.vad || NEUTRAL_EMOTION.vad
    };
}

function getMoodPrefix(label) {
    const lowered = (label || "").toLowerCase();
    if (lowered.includes("joy") || lowered.includes("trust")) {
        return "retrouve le sourire.";
    }

    if (lowered.includes("fear") || lowered.includes("anx")) {
        return "jette un oeil par-dessus son épaule.";
    }

    if (lowered.includes("anger")) {
        return "serre les dents.";
    }

    if (lowered.includes("sad") || lowered.includes("grief")) {
        return "laisse planer un silence.";
    }

    if (lowered.includes("curi")) {
        return "se penche, tout ouïe.";
    }

    if (lowered.includes("relief")) {
        return "souffle lentement.";
    }

    return "";
}

function wrapDialogue(text, lineLength, maxLines) {
    const words = (text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (nextLine.length > lineLength) {
            if (currentLine) {
                lines.push(currentLine);
            }
            currentLine = word;
        } else {
            currentLine = nextLine;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.slice(0, maxLines);
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

module.exports = new NpcEmotionService();
