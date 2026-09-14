/**
 * Trilingual message catalog: English (en), Canadian French (fr), and Spanish (es).
 * Earth Anomaly Observatory UI messages.
 */

export type Lang = "en" | "fr" | "es";

const en = {
  langName: "English",
  documentTitle: "Earth Anomaly Observatory",

  app: {
    title: "Earth Anomaly Observatory",
  },

  lang: {
    label: "Language",
  },

  heading: {
    eyebrow: "LIVE DASHBOARD",
    search: "Search anomalies",
    searchPlaceholder: "Search by name, region, or type...",
    export: "Export",
    sync: "Sync",
  },

  queue: {
    title: "Anomaly Queue",
    options: "Options",
  },

  topbar: {
    mainNav: "Main navigation",
    notifications: "Notifications",
  },

  toast: {
    switchView: ({ name }: { name: string }) => `Switched to ${name}`,
    notifications: "No new notifications",
    add: "Feature coming soon",
  },

  shell: {
    loading: "Loading data…",
    offline: "Unable to load data",
    switchLanguage: "Switch language",
  },

  notFound: {
    meta: "Page Not Found",
    title: "Error",
    copy: "This page may have been removed or does not exist. Please check that the URL is correct.",
    back: "Back to Home",
  },

  dashboard: {
    title: "Earth Anomaly Observatory",
    monitoring: "Monitoring",
    activeEvents: "active events",
    spaceWeatherEpisodes: "space weather episode",
    spaceWeatherEpisodesPl: "space weather episodes",
    live_anna: "Live · Anna Executa",
    live_direct: "Live · Direct Feed",
    demoData: "Demo Data",
    globalAnomalyIndex: "Global Anomaly Index",
    clickToLearn: "Click to learn how it's calculated",
    search: "Search events or regions…",
    refresh: "Refresh",
    export: "Export JSON",
    eventCount: "event",
    eventCountPl: "events",
    loading: "Loading events…",
    noEvents: "No events match the current filter.",
    category: "Category",
    region: "Region",
    age: "Age",
    priority: "Priority",
    severe: "Severe",
    moderate: "Moderate",
    minor: "Minor",
    pageOf: "Page",
    of: "of",
    domains: {
      earthquake: "Earthquake",
      wildfire: "Wildfire",
      storm: "Storm",
      flood: "Flood",
      volcano: "Volcano",
      ice: "Ice Event",
      space_weather: "Space Weather",
    },
    domainShort: {
      earthquake: "Quakes",
      wildfire: "Fire",
      storm: "Storms",
      flood: "Floods",
      volcano: "Volcano",
      ice: "Ice",
      space_weather: "Space",
    },
    alerts: {
      normal: "Normal",
      elevated: "Elevated",
      highActivity: "High Activity",
      veryHigh: "Very High",
      critical: "Critical",
    },
    detail: {
      region: "Region",
      detectedAt: "Detected at",
      signalAge: "Signal age",
      confidence: "Confidence",
      magnitude: "Magnitude",
      depth: "Depth",
      alertLevel: "Alert level",
      phenomenon: "Phenomenon",
      scale: "Scale",
      altitude: "Altitude",
      velocity: "Velocity",
      coordinates: "Coordinates",
      viewSource: "View source",
    },
    gaiModal: {
      title: "Global Anomaly Index",
      subtitle: "How we measure planetary activity across 7 critical domains",
      methodology: "Methodology",
      methodologyDesc: "The Global Anomaly Index (GAI) combines normalized scores from seven Earth monitoring domains using weighted averaging. Each domain is scored 0–100 based on its current activity level relative to historical baselines.",
      domainWeights: "Domain Weights",
      severityScale: "Severity Scale",
      severityNormal: "Normal",
      severityNormalDesc: "0–20: Activity within historical norms",
      severityElevated: "Elevated",
      severityElevatedDesc: "21–40: Above-average activity",
      severityHigh: "High Activity",
      severityHighDesc: "41–60: Multiple domains elevated",
      severityVeryHigh: "Very High",
      severityVeryHighDesc: "61–80: Significant global anomaly cluster",
      severityExtreme: "Extreme",
      severityExtremeDesc: "81–100: Critical multi-domain activity",
      dataSources: "Data Sources",
      dataSourceUSGS: "USGS Earthquake Hazards Program (magnitude ≥4.5, 14-day window)",
      dataSourceEONET: "NASA EONET Natural Event Tracker (open events)",
      dataSourceGDACS: "UN GDACS Disaster System (floods, volcanoes)",
      dataSourceSWPC: "NOAA Space Weather Prediction Center (geomagnetic storms, solar activity)",
      note: "This index is designed for public awareness and situational understanding. For research or operational decisions, consult authoritative sources directly.",
      domainDescriptions: {
        earthquake: "Tectonic activity and seismic events",
        wildfire: "Active fires and burned area extent",
        storm: "Severe weather systems and atmospheric activity",
        flood: "Water level anomalies and inundation events",
        volcano: "Volcanic activity and thermal anomalies",
        ice: "Sea ice extent and glacial changes",
        space_weather: "Geomagnetic storms and solar radiation",
      },
    },
    ai: {
      insightsTitle: "What's happening right now",
      insightsSub: "AI-powered plain-language summary of current Earth observations",
      analysing: "Analysing…",
      refresh: "Refresh",
      analysingConditions: "Analysing current Earth conditions…",
      aiAvailable: "AI insights available on Anna platform",
      standaloneMode: "Running in standalone mode — connect to Anna for live LLM analysis.",
      assessmentFailed: "Assessment failed:",
      tryAgain: "Try again",
      showLess: "Show less ↑",
      showDetailed: "Show detailed analysis ↓",
      situationAssessment: "AI Situation Assessment",
      beta: "BETA",
      regenerate: "Regenerate assessment",
      assessmentRequired: "AI assessment requires the Anna platform.",
      llmUnavailable: "Running in standalone mode — LLM unavailable.",
      assessmentError: "Assessment error:",
      currentConditions: "Analysing current conditions…",
      keyDevelopments: "Key Developments",
      evidence: "Evidence",
      trend: "Trend:",
      evidenceStrength: "Evidence:",
      strong: "Strong",
      moderate: "Moderate",
      limited: "Limited",
    },
    tones: {
      playful: {
        label: "Playful",
        name: "✨ What's Amazing Today",
        system: "You are enthusiastic and positive about Earth news. Share observations joyfully and celebrate resilience. Be conversational, uplifting, and find the amazing angle in everything.",
        format: "Write natural flowing text with key points. Just tell what's happening with joy and wonder:\n\n- Situation: One sentence about what's going on\n- Key observations: Important things happening (2-3 sentences)\n- Connections: How things relate (1-2 sentences)\n- What to watch: Things worth monitoring (1-2 sentences)\n\nKeep it SHORT, punchy, positive. Sound excited and genuine!"
      },
      hilarious: {
        label: "Hilarious",
        name: "💀 BREAKING NEWS FROM PLANET EARTH",
        system: "You are a sarcastic, dark-humor planet correspondent. Your job is to deliver Earth and space data with hilarious, witty commentary and death jokes. Make people laugh at the cosmic absurdity. Be irreverent, unexpected, and funny while remaining factually accurate. Think of it like stand-up comedy about planet Earth.",
        format: "Layout should be visually unusual and comedic:\n\n☠️ THIS JUST IN: [Funny dramatic headline]\nA darkly comic 2-3 sentence take on what's happening. Lean into the absurd.\n\n💀 NATURE'S GREATEST HITS\n• One devastating (but hilarious) observation per bullet (max 4). Crack jokes. Be sarcastic.\n\n🎭 THE PLOT TWIST\n1-2 sentences of comedic commentary on cosmic timing or ironies.\n\n🎬 PREPARE FOR\n- 1-3 things coming up, described with comedic dread or jest.\n\nRules: Make them laugh, not uncomfortable. Stay truthful. Use dark humor and sarcasm. Emoji usage is encouraged for visual comedy."
      },
      kids: {
        label: "Kids",
        name: "🎨 Amazing Earth & Space Stories",
        system: "You are a warm, friendly storyteller telling Earth news like a bedtime story to children. Use simple words and familiar character comparisons (Hulk, Spiderman, Elsa, etc.). Make it cozy, safe, fun, and dreamy - never scary.",
        format: "Just tell a natural, warm story. Weave together what's happening on Earth in one flowing narrative using:\n\n- Simple words only (6-year-old level)\n- Character comparisons (like 'earthquake is like Hulk stomping')\n- Cozy, dreamy tone\n- Emojis naturally scattered throughout\n\nSound like you're tucking them in and sharing exciting dreams about our planet. Keep it SHORT and sweet!"
      },
      scientific: {
        label: "Scientific",
        name: "🔬 Scientific Analysis",
        system: "You are a rigorous scientific analyst for an Earth and space-weather monitoring system. Provide objective, data-driven analysis with precise measurements and uncertainty quantification. Use formal scientific language and maintain strict evidence-based reasoning.",
        format: "Use formal scientific sections:\n\nSITUATION\n2–4 sentences of objective conditions with measurements and units.\n\nKEY OBSERVATIONS\n- One observation per bullet (max 5). Format: Domain/Region — measurement with units and baseline comparison.\n\nCROSS-DOMAIN ANALYSIS\n1–2 sentences of correlational observations only. No causal claims.\n\nRECOMMENDED MONITORING\n- 1–3 evidence-based monitoring priorities.\n\nRules: Formal tone. Use units precisely. Quantify uncertainty. Evidence-based only. No speculation."
      },
      mentor: {
        label: "Mentor",
        name: "👤 Let's Talk About This",
        system: "You are a trusted friend and mentor sharing Earth insights. Be direct, warm, genuine, and brief. Give practical wisdom grounded in data.",
        format: "Write SHORT paragraphs naturally. Each paragraph one key point:\n\n- What's happening (1-2 sentences)\n- Key insights (1-2 sentences each, separate paragraphs)\n- How things connect (1-2 sentences)\n- What to watch (1-2 sentences each, separate paragraphs)\n\nSound like a real friend. Be honest and direct. Keep each thought BRIEF."
      }
    },
  },
};

export type Messages = typeof en;

const fr: Messages = {
  langName: "Français",
  documentTitle: "Observatoire des anomalies terrestres",

  app: {
    title: "Observatoire des anomalies terrestres",
  },

  lang: {
    label: "Langue",
  },

  heading: {
    eyebrow: "TABLEAU DE BORD EN DIRECT",
    search: "Rechercher des anomalies",
    searchPlaceholder: "Rechercher par nom, région ou type...",
    export: "Exporter",
    sync: "Synchroniser",
  },

  queue: {
    title: "File d'attente des anomalies",
    options: "Options",
  },

  topbar: {
    mainNav: "Navigation principale",
    notifications: "Notifications",
  },

  toast: {
    switchView: ({ name }: { name: string }) => `Basculer vers ${name}`,
    notifications: "Pas de nouvelles notifications",
    add: "Fonctionnalité à venir",
  },

  shell: {
    loading: "Chargement des données…",
    offline: "Impossible de charger les données",
    switchLanguage: "Changer la langue",
  },

  notFound: {
    meta: "Page non trouvée",
    title: "Erreur",
    copy: "Cette page a peut-être été supprimée ou n'existe pas. Vérifiez que l'adresse est correcte.",
    back: "Retour à l'accueil",
  },

  dashboard: {
    title: "Observatoire des anomalies terrestres",
    monitoring: "Surveillance",
    activeEvents: "événements actifs",
    spaceWeatherEpisodes: "épisode météorologique spatiale",
    spaceWeatherEpisodesPl: "épisodes météorologiques spatiales",
    live_anna: "En direct · Anna Executa",
    live_direct: "En direct · Flux direct",
    demoData: "Données de démo",
    globalAnomalyIndex: "Indice d'anomalie mondiale",
    clickToLearn: "Cliquez pour savoir comment il est calculé",
    search: "Rechercher des événements ou des régions…",
    refresh: "Actualiser",
    export: "Exporter JSON",
    eventCount: "événement",
    eventCountPl: "événements",
    loading: "Chargement des événements…",
    noEvents: "Aucun événement ne correspond au filtre actuel.",
    category: "Catégorie",
    region: "Région",
    age: "Âge",
    priority: "Priorité",
    severe: "Grave",
    moderate: "Modéré",
    minor: "Mineur",
    pageOf: "Page",
    of: "de",
    domains: {
      earthquake: "Tremblement de terre",
      wildfire: "Incendie de forêt",
      storm: "Tempête",
      flood: "Inondation",
      volcano: "Volcan",
      ice: "Événement glaciaire",
      space_weather: "Météorologie spatiale",
    },
    domainShort: {
      earthquake: "Tremblements",
      wildfire: "Incendies",
      storm: "Tempêtes",
      flood: "Inondations",
      volcano: "Volcan",
      ice: "Glace",
      space_weather: "Espace",
    },
    alerts: {
      normal: "Normal",
      elevated: "Élevé",
      highActivity: "Activité élevée",
      veryHigh: "Très élevé",
      critical: "Critique",
    },
    detail: {
      region: "Région",
      detectedAt: "Détecté à",
      signalAge: "Âge du signal",
      confidence: "Confiance",
      magnitude: "Magnitude",
      depth: "Profondeur",
      alertLevel: "Niveau d'alerte",
      phenomenon: "Phénomène",
      scale: "Échelle",
      altitude: "Altitude",
      velocity: "Vitesse",
      coordinates: "Coordonnées",
      viewSource: "Afficher la source",
    },
    gaiModal: {
      title: "Indice d'anomalie mondiale",
      subtitle: "Comment nous mesurons l'activité planétaire dans 7 domaines critiques",
      methodology: "Méthodologie",
      methodologyDesc: "L'indice d'anomalie mondiale (GAI) combine les scores normalisés de sept domaines de surveillance terrestre en utilisant une moyenne pondérée. Chaque domaine est noté de 0 à 100 en fonction de son niveau d'activité actuel par rapport aux références historiques.",
      domainWeights: "Poids des domaines",
      severityScale: "Échelle de gravité",
      severityNormal: "Normal",
      severityNormalDesc: "0–20 : Activité conforme aux normes historiques",
      severityElevated: "Élevé",
      severityElevatedDesc: "21–40 : Activité supérieure à la moyenne",
      severityHigh: "Activité élevée",
      severityHighDesc: "41–60 : Plusieurs domaines élevés",
      severityVeryHigh: "Très élevé",
      severityVeryHighDesc: "61–80 : Amas d'anomalies mondial significatif",
      severityExtreme: "Extrême",
      severityExtremeDesc: "81–100 : Activité critique multi-domaine",
      dataSources: "Sources de données",
      dataSourceUSGS: "Programme de prévention des tremblements de terre de l'USGS (magnitude ≥4,5, fenêtre de 14 jours)",
      dataSourceEONET: "Suivi des événements naturels NASA EONET (événements ouverts)",
      dataSourceGDACS: "Système de catastrophes UN GDACS (inondations, volcans)",
      dataSourceSWPC: "Centre de prévision de la météorologie spatiale NOAA (tempêtes géomagnétiques, activité solaire)",
      note: "Cet indice est conçu pour la sensibilisation du public et la compréhension situationnelle. Pour les décisions de recherche ou opérationnelles, consultez directement les sources officielles.",
      domainDescriptions: {
        earthquake: "Activité tectonique et événements sismiques",
        wildfire: "Incendies actifs et étendue des zones brûlées",
        storm: "Systèmes météorologiques graves et activité atmosphérique",
        flood: "Anomalies du niveau de l'eau et inondations",
        volcano: "Activité volcanique et anomalies thermiques",
        ice: "Étendue de la glace de mer et changements glaciaires",
        space_weather: "Tempêtes géomagnétiques et rayonnement solaire",
      },
    },
    ai: {
      insightsTitle: "Ce qui se passe en ce moment",
      insightsSub: "Résumé en langage clair alimenté par l'IA des observations terrestres actuelles",
      analysing: "Analyse en cours…",
      refresh: "Actualiser",
      analysingConditions: "Analyse des conditions terrestres actuelles…",
      aiAvailable: "Aperçus IA disponibles sur la plateforme Anna",
      standaloneMode: "Mode autonome — connectez-vous à Anna pour une analyse LLM en direct.",
      assessmentFailed: "Évaluation échouée:",
      tryAgain: "Réessayer",
      showLess: "Afficher moins ↑",
      showDetailed: "Afficher l'analyse détaillée ↓",
      situationAssessment: "Évaluation de la situation par l'IA",
      beta: "BÊTA",
      regenerate: "Régénérer l'évaluation",
      assessmentRequired: "L'évaluation par l'IA nécessite la plateforme Anna.",
      llmUnavailable: "Mode autonome — LLM non disponible.",
      assessmentError: "Erreur d'évaluation:",
      currentConditions: "Analyse des conditions actuelles…",
      keyDevelopments: "Développements clés",
      evidence: "Preuves",
      trend: "Tendance:",
      evidenceStrength: "Preuves:",
      strong: "Fort",
      moderate: "Modéré",
      limited: "Limité",
    },
    tones: {
      playful: {
        label: "Joyeux",
        name: "✨ Ce qui est extraordinaire aujourd'hui",
        system: "Vous êtes enthousiaste et positif à propos des nouvelles terrestres. Partagez les observations avec joie et célébrez la résilience. Soyez conversationnel, positif et trouvez l'angle inspirant dans tout.",
        format: "Écrivez du texte naturel et fluide avec les points clés. Dites simplement ce qui se passe avec joie et émerveillement:\n\n- Situation: Une phrase sur ce qui se passe\n- Observations clés: Choses importantes qui se produisent (2-3 phrases)\n- Connexions: Comment les choses sont liées (1-2 phrases)\n- À surveiller: Choses à surveiller (1-2 phrases)\n\nGardez-le COURT, percutant, positif. Sonnez enthousiaste et authentique!"
      },
      hilarious: {
        label: "Hilarant",
        name: "💀 DERNIÈRES NOUVELLES DE LA PLANÈTE TERRE",
        system: "Vous êtes un correspondant planétaire sarcastique et plein d'humour noir. Votre travail est de fournir les données terrestres et spatiales avec des commentaires pleins d'esprit et des blagues morbides. Faites rire les gens face à l'absurdité cosmique. Soyez irrévérencieux, inattendu et drôle tout en restant factuellement précis. C'est comme du stand-up comedy sur la planète Terre.",
        format: "La mise en page devrait être visuellement insolite et comique:\n\n☠️ FLASH INFO: [Titre dramatique amusant]\nUne prise sarcastique et sombre de 2-3 phrases sur ce qui se passe. Jouez sur l'absurde.\n\n💀 LES GRANDS MOMENTS DE LA NATURE\n• Une observation dévastatrice (mais hilarante) par puce (max 4). Faites des blagues. Soyez sarcastique.\n\n🎭 LE RETOURNEMENT\n1-2 phrases de commentaires comiques sur les ironies ou le timing cosmique.\n\n🎬 PRÉPAREZ-VOUS À\n- 1-3 choses à venir, décrites avec une frayeur ou une plaisanterie comique.\n\nRègles: Faites-les rire, pas mal à l'aise. Restez fidèle aux faits. Utilisez l'humour noir et le sarcasme. L'utilisation d'émojis est encouragée pour la comédie visuelle."
      },
      kids: {
        label: "Enfants",
        name: "🎨 Incroyables histoires de la Terre et de l'espace",
        system: "Vous êtes un conteur chaleureux et amical qui raconte les nouvelles de la Terre comme une histoire au coucher du soleil pour les enfants. Utilisez des mots simples et des comparaisons de personnages familiers (Hulk, Spiderman, Elsa, etc.). Rendez-le douillet, sûr, amusant et onirique - jamais effrayant.",
        format: "Dites simplement une histoire naturelle et chaleureuse. Tissez ensemble ce qui se passe sur Terre dans un récit fluide en utilisant:\n\n- Seuls des mots simples (niveau 6 ans)\n- Comparaisons de personnages (comme 'le tremblement de terre c'est comme le Hulk qui piétine')\n- Ton douillet et onirique\n- Émojis naturellement dispersés partout\n\nSonnez comme si vous les bordez et partagez des rêves excitants sur notre planète. Gardez-le COURT et doux!"
      },
      scientific: {
        label: "Scientifique",
        name: "🔬 Analyse scientifique",
        system: "Vous êtes un analyste scientifique rigoureux pour un système de surveillance des conditions terrestres et spatiales. Fournissez une analyse objective et fondée sur les données avec des mesures précises et une quantification de l'incertitude. Utilisez un langage scientifique formel et maintenez un raisonnement strictement basé sur les preuves.",
        format: "Utilisez des sections scientifiques formelles:\n\nSITUATION\n2–4 phrases de conditions objectives avec mesures et unités.\n\nOBSERVATIONS CLÉS\n- Une observation par puce (max 5). Format: Domaine/Région — mesure avec unités et comparaison de base.\n\nANALYSE TRANSDOMINALE\n1–2 phrases d'observations de corrélation uniquement. Pas de réclamations causales.\n\nSURVEILLANCE RECOMMANDÉE\n- 1–3 priorités de surveillance basées sur les preuves.\n\nRègles: Ton formel. Utilisez les unités précisément. Quantifiez l'incertitude. Basé sur les preuves uniquement. Pas de spéculation."
      },
      mentor: {
        label: "Mentor",
        name: "👤 Parlons-en",
        system: "Vous êtes un ami de confiance et un mentor partageant les perspectives terrestres. Soyez direct, chaleureux, authentique et bref. Donnez une sagesse pratique fondée sur les données.",
        format: "Écrivez des paragraphes COURTS naturellement. Chaque paragraphe un point clé:\n\n- Ce qui se passe (1-2 phrases)\n- Intuitions clés (1-2 phrases chacun, paragraphes séparés)\n- Comment les choses se connectent (1-2 phrases)\n- À surveiller (1-2 phrases chacun, paragraphes séparés)\n\nSonnez comme un vrai ami. Soyez honnête et direct. Gardez chaque pensée BRÈVE."
      }
    },
  },
};

const es: Messages = {
  langName: "Español",
  documentTitle: "Observatorio de Anomalías Terrestres",

  app: {
    title: "Observatorio de Anomalías Terrestres",
  },

  lang: {
    label: "Idioma",
  },

  heading: {
    eyebrow: "PANEL EN DIRECTO",
    search: "Buscar anomalías",
    searchPlaceholder: "Buscar por nombre, región o tipo...",
    export: "Exportar",
    sync: "Sincronizar",
  },

  queue: {
    title: "Cola de anomalías",
    options: "Opciones",
  },

  topbar: {
    mainNav: "Navegación principal",
    notifications: "Notificaciones",
  },

  toast: {
    switchView: ({ name }: { name: string }) => `Cambiar a ${name}`,
    notifications: "Sin notificaciones nuevas",
    add: "Próximamente",
  },

  shell: {
    loading: "Cargando datos…",
    offline: "No se pueden cargar los datos",
    switchLanguage: "Cambiar idioma",
  },

  notFound: {
    meta: "Página no encontrada",
    title: "Error",
    copy: "Esta página puede haber sido eliminada o no existe. Verifica que la URL sea correcta.",
    back: "Volver al inicio",
  },

  dashboard: {
    title: "Observatorio de Anomalías Terrestres",
    monitoring: "Monitoreando",
    activeEvents: "eventos activos",
    spaceWeatherEpisodes: "episodio de clima espacial",
    spaceWeatherEpisodesPl: "episodios de clima espacial",
    live_anna: "En directo · Anna Executa",
    live_direct: "En directo · Alimentación directa",
    demoData: "Datos de demostración",
    globalAnomalyIndex: "Índice de anomalía global",
    clickToLearn: "Haz clic para saber cómo se calcula",
    search: "Buscar eventos o regiones…",
    refresh: "Actualizar",
    export: "Exportar JSON",
    eventCount: "evento",
    eventCountPl: "eventos",
    loading: "Cargando eventos…",
    noEvents: "Ningún evento coincide con el filtro actual.",
    category: "Categoría",
    region: "Región",
    age: "Antigüedad",
    priority: "Prioridad",
    severe: "Severo",
    moderate: "Moderado",
    minor: "Menor",
    pageOf: "Página",
    of: "de",
    domains: {
      earthquake: "Terremoto",
      wildfire: "Incendio forestal",
      storm: "Tormenta",
      flood: "Inundación",
      volcano: "Volcán",
      ice: "Evento de hielo",
      space_weather: "Clima espacial",
    },
    domainShort: {
      earthquake: "Terremotos",
      wildfire: "Incendios",
      storm: "Tormentas",
      flood: "Inundaciones",
      volcano: "Volcán",
      ice: "Hielo",
      space_weather: "Espacio",
    },
    alerts: {
      normal: "Normal",
      elevated: "Elevado",
      highActivity: "Actividad alta",
      veryHigh: "Muy alto",
      critical: "Crítico",
    },
    detail: {
      region: "Región",
      detectedAt: "Detectado en",
      signalAge: "Edad de la señal",
      confidence: "Confianza",
      magnitude: "Magnitud",
      depth: "Profundidad",
      alertLevel: "Nivel de alerta",
      phenomenon: "Fenómeno",
      scale: "Escala",
      altitude: "Altitud",
      velocity: "Velocidad",
      coordinates: "Coordenadas",
      viewSource: "Ver fuente",
    },
    gaiModal: {
      title: "Índice de anomalía global",
      subtitle: "Cómo medimos la actividad planetaria en 7 dominios críticos",
      methodology: "Metodología",
      methodologyDesc: "El Índice de Anomalía Global (IAG) combina puntuaciones normalizadas de siete dominios de monitoreo terrestre usando promedios ponderados. Cada dominio se califica 0–100 según su nivel de actividad actual en relación con los valores históricos.",
      domainWeights: "Pesos de los dominios",
      severityScale: "Escala de gravedad",
      severityNormal: "Normal",
      severityNormalDesc: "0–20: Actividad dentro de las normas históricas",
      severityElevated: "Elevado",
      severityElevatedDesc: "21–40: Actividad por encima del promedio",
      severityHigh: "Actividad alta",
      severityHighDesc: "41–60: Múltiples dominios elevados",
      severityVeryHigh: "Muy alto",
      severityVeryHighDesc: "61–80: Aglomeración de anomalías globales significativa",
      severityExtreme: "Extremo",
      severityExtremeDesc: "81–100: Actividad crítica multi-dominio",
      dataSources: "Fuentes de datos",
      dataSourceUSGS: "Programa de Peligros Sísmicos del USGS (magnitud ≥4,5, ventana de 14 días)",
      dataSourceEONET: "Rastreador de eventos naturales NASA EONET (eventos abiertos)",
      dataSourceGDACS: "Sistema de desastres UN GDACS (inundaciones, volcanes)",
      dataSourceSWPC: "Centro de predicción del clima espacial NOAA (tormentas geomagnéticas, actividad solar)",
      note: "Este índice está diseñado para la conciencia pública y la comprensión situacional. Para decisiones de investigación u operativas, consulte directamente las fuentes autorizadas.",
      domainDescriptions: {
        earthquake: "Actividad tectónica y eventos sísmicos",
        wildfire: "Incendios activos y extensión de área quemada",
        storm: "Sistemas de clima severo y actividad atmosférica",
        flood: "Anomalías del nivel del agua e inundaciones",
        volcano: "Actividad volcánica y anomalías térmicas",
        ice: "Extensión de hielo marino y cambios glaciares",
        space_weather: "Tormentas geomagnéticas y radiación solar",
      },
    },
    ai: {
      insightsTitle: "Lo que está sucediendo ahora mismo",
      insightsSub: "Resumen en lenguaje plano impulsado por IA de observaciones terrestres actuales",
      analysing: "Analizando…",
      refresh: "Actualizar",
      analysingConditions: "Analizando condiciones terrestres actuales…",
      aiAvailable: "Información de IA disponible en la plataforma Anna",
      standaloneMode: "Modo independiente — conéctese a Anna para análisis LLM en vivo.",
      assessmentFailed: "Evaluación fallida:",
      tryAgain: "Intentar de nuevo",
      showLess: "Mostrar menos ↑",
      showDetailed: "Mostrar análisis detallado ↓",
      situationAssessment: "Evaluación de situación por IA",
      beta: "BETA",
      regenerate: "Regenerar evaluación",
      assessmentRequired: "La evaluación de IA requiere la plataforma Anna.",
      llmUnavailable: "Modo independiente — LLM no disponible.",
      assessmentError: "Error de evaluación:",
      currentConditions: "Analizando condiciones actuales…",
      keyDevelopments: "Desarrollos clave",
      evidence: "Evidencia",
      trend: "Tendencia:",
      evidenceStrength: "Evidencia:",
      strong: "Fuerte",
      moderate: "Moderado",
      limited: "Limitado",
    },
    tones: {
      playful: {
        label: "Juguetón",
        name: "✨ Lo que es asombroso hoy",
        system: "Eres entusiasta y positivo sobre las noticias de la Tierra. Comparte observaciones alegremente y celebra la resiliencia. Sé conversacional, positivo y encuentra el ángulo inspirador en todo.",
        format: "Escribe texto natural y fluido con puntos clave. Solo dile qué está pasando con alegría y asombro:\n\n- Situación: Una oración sobre lo que está sucediendo\n- Observaciones clave: Cosas importantes que suceden (2-3 oraciones)\n- Conexiones: Cómo se relacionan las cosas (1-2 oraciones)\n- A observar: Cosas a monitorear (1-2 oraciones)\n\n¡Mantente CORTO, directo, positivo. ¡Suena entusiasta y genuino!",
      },
      hilarious: {
        label: "Hilarante",
        name: "💀 NOTICIAS DE ÚLTIMA HORA DEL PLANETA TIERRA",
        system: "Eres un corresponsal planetario sarcástico y de humor negro. Tu trabajo es entregar datos terrestres y espaciales con comentarios ingeniosos y bromas oscuras. Haz reír a la gente ante la absurdidad cósmica. Sé irreverente, inesperado y divertido mientras permaneces siendo precisamente fáctico. Es como comedia de stand-up sobre el planeta Tierra.",
        format: "La presentación debe ser visualmente inusual y cómica:\n\n☠️ FLASH INFORMATIVO: [Titular dramático divertido]\nUna perspectiva cómica y oscura de 2-3 oraciones sobre lo que está sucediendo. Inclínate hacia lo absurdo.\n\n💀 LOS MAYORES ÉXITOS DE LA NATURALEZA\n• Una observación devastadora (pero hilarante) por viñeta (máx. 4). Haz bromas. Sé sarcástico.\n\n🎭 EL GIRO DE LA TRAMA\n1-2 oraciones de comentario cómico sobre ironías cósmicas o sincronización.\n\n🎬 PREPÁRATE PARA\n- 1-3 cosas que se aproximan, descritas con terror o burla cómica.\n\nReglas: Hazlos reír, no incómodos. Mantente fiel a los hechos. Usa humor oscuro y sarcasmo. Se alienta el uso de emojis para comedia visual.",
      },
      kids: {
        label: "Niños",
        name: "🎨 Historias sorprendentes de la Tierra y el espacio",
        system: "Eres un narrador cálido y amable que cuenta noticias de la Tierra como una historia para dormir a los niños. Usa palabras simples y comparaciones de personajes familiares (Hulk, Spiderman, Elsa, etc.). Hazlo acogedor, seguro, divertido y soñador - nunca aterrador.",
        format: "Solo cuenta una historia natural y cálida. Teje lo que está sucediendo en la Tierra en una narrativa fluida usando:\n\n- Solo palabras simples (nivel de 6 años)\n- Comparaciones de personajes (como 'el terremoto es como el Hulk pisando')\n- Tono acogedor y soñador\n- Emojis naturalmente dispersos por todo el lugar\n\n¡Suena como si los estuvieras acostando y compartiendo sueños emocionantes sobre nuestro planeta. ¡Mantenlo CORTO y dulce!",
      },
      scientific: {
        label: "Científico",
        name: "🔬 Análisis científico",
        system: "Eres un analista científico riguroso para un sistema de monitoreo de condiciones terrestres y espaciales. Proporciona análisis objetivo y basado en datos con mediciones precisas y cuantificación de incertidumbre. Utiliza lenguaje científico formal y mantén un razonamiento estrictamente basado en evidencia.",
        format: "Utiliza secciones científicas formales:\n\nSITUACIÓN\n2–4 oraciones de condiciones objetivas con mediciones y unidades.\n\nOBSERVACIONES CLAVE\n- Una observación por viñeta (máx. 5). Formato: Dominio/Región — medición con unidades y comparación de referencia.\n\nANÁLISIS ENTRE DOMINIOS\n1–2 oraciones de observaciones correlacionales solamente. Sin afirmaciones causales.\n\nMONITOREO RECOMENDADO\n- 1–3 prioridades de monitoreo basadas en evidencia.\n\nReglas: Tono formal. Usa las unidades con precisión. Cuantifica la incertidumbre. Solo basado en evidencia. Sin especulación.",
      },
      mentor: {
        label: "Mentor",
        name: "👤 Hablemos de esto",
        system: "Eres un amigo de confianza y mentor que comparte perspectivas terrestres. Sé directo, cálido, genuino y breve. Proporciona sabiduría práctica basada en datos.",
        format: "Escribe párrafos CORTOS de forma natural. Cada párrafo un punto clave:\n\n- Qué está sucediendo (1-2 oraciones)\n- Perspectivas clave (1-2 oraciones cada una, párrafos separados)\n- Cómo se conectan las cosas (1-2 oraciones)\n- A observar (1-2 oraciones cada una, párrafos separados)\n\nSuena como un amigo real. Sé honesto y directo. Mantén cada pensamiento BREVE.",
      },
    },
  },
};

export const messages: Record<Lang, Messages> = { en, fr, es };

/** Flat dot-notation key for any string value in the message catalog. */
export type MessageKey = string;

export const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
];

export function localeTag(lang: Lang) {
  return lang === "fr" ? "fr-CA" : lang === "es" ? "es" : "en-CA";
}
