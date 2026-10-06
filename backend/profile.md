# Fiche de profil de l'assistant

Ce fichier est lu par l'assistant avant chaque réponse (pas besoin de redémarrer le
serveur après une modification). C'est sa **seule source d'information** sur Dhafer et
Quality Crew : il ne doit rien inventer qui ne soit pas écrit ici.

Sources : CV de Dhafer (2026) et le site www.qualitycrew.fr.

## Dhafer

- Nom : Dhafer Bouthelja.
- Métier : responsable qualité, aujourd'hui Team Lead Quality Software chez ACTIA Engineering Services.
- Présentation : 18 ans d'expérience dans l'électronique automobile et industrielle, des lignes de
  production et des audits clients jusqu'à la conformité ASPICE, ISO 26262 et ISO/SAE 21434 sur des
  programmes de logiciel embarqué. Il a conçu et fait tourner des systèmes qualité d'usine selon
  ISO 9001 et IATF 16949, et dirigé des services qualité de 25 à 50 personnes.
- Résultats marquants : réduction du PPM client de plus de 20 % (depuis plus de 1 000 PPM) et du
  taux de rebut de plus de 30 % (depuis plus de 5 %). En mars 2026, les cinq processus de son
  périmètre ont atteint le niveau de capacité 2 Automotive SPICE lors de l'évaluation interne du groupe ACTIA.
- Langues : arabe (langue maternelle), français (courant), anglais (professionnel ; il mène des audits clients en anglais).
- Basé à La Marsa, Tunis (Tunisie), ouvert à la mobilité internationale.

## Parcours

- Depuis août 2025 — Team Lead Quality Software, ACTIA Engineering Services : encadre 4 ingénieurs
  qualité sur un programme de 7 projets et plus de 100 ingénieurs ; responsable du système de
  management de la qualité, des indicateurs (KPI), de la feuille de route d'amélioration et de la
  préparation aux audits (clients, internes, processus).
- Avril 2023 – août 2025 — Software Quality Engineer, ACTIA Engineering Services : conformité des
  processus sur des projets embarqués automobiles et industriels (drivers STM32), selon ASPICE et le
  cycle en V ; revues de conformité SRS, SDD, MTP, MTR ; suivi des jalons de maturité de Code Alpha à
  Release ; règles de codage et analyse statique avec LDRA, MISRA et Coverity ; préparation de la
  migration vers une CI/CD dans le cloud et les tests automatisés.
- 2008 – 2023 — CIPI ACTIA (groupe ACTIA, fabrication d'électronique automobile) :
  - Décembre 2020 – mai 2023 : Deputy Quality Manager. Pilotage du système qualité de l'usine
    (ISO 9001 / IATF 16949) pour des constructeurs européens et des équipementiers de rang 1
    (Volvo, Scania, Jaguar, Continental) ; audits clients et de certification ; PPAP, AMDEC (FMEA),
    QRQC, 8D, CAPA.
  - Décembre 2011 – novembre 2020 : Team Lead Quality Control. Encadrement des équipes de contrôle
    qualité ; analyses de défauts par rayons X, microscopie et métallographie ; animation des 8D.
  - Octobre 2008 – décembre 2011 : Industrial Performance Engineer. Suivi TRS (OEE), TPM, MTBF/MTTR,
    capacité ; campagnes de productivité ; études techniques et de coûts pour l'industrialisation.

## Compétences

- Systèmes qualité : ISO 9001, IATF 16949, conception et déploiement de SMQ, audits clients et de certification.
- Qualité de production : contrôle réception, contrôle en cours de fabrication, AMDEC (FMEA), PPAP, 8D, QRQC, CAPA, analyse de cause racine.
- Qualité logicielle et sûreté : Automotive SPICE, ISO 26262, IEC 61508, ISO/SAE 21434, analyse statique (LDRA, MISRA, Coverity).
- Management : services qualité de 25 à 50 personnes, indicateurs qualité, amélioration continue, coaching.
- Outils et tech : Power BI, Python, agents IA (CrewAI), cloud et DevOps.

## Formation et certifications

- Diplôme d'ingénieur en informatique, ESPRIT (Tunis), obtenu en 2025 (cursus 2021–2025), mention très bien, en cours du soir tout en travaillant à plein temps.
- Licence en génie électrique industriel, ISET Radès, 2020–2021, mention très bien.
- Diplôme de technicien supérieur en électronique, ISET Nabeul, 2005–2008.
- Certifications : Certified AI Security & Risk (CAISR, Red Team Leaders, 2026) ; Manage Kubernetes in
  Google Cloud (2026) ; AWS Cloud Security Builder & Foundations (2025) ; AI for Anomaly Detection,
  NVIDIA (2025) ; Ansible (2024) ; formateur certifié IPC-A-610 (2019).

## Quality Crew (www.qualitycrew.fr)

- Ce que c'est : le projet personnel de Dhafer, qu'il a conçu, développé, déployé, et qu'il héberge
  et exploite lui-même. Six outils de démonstration autour de la conformité normative et de la
  sécurité de l'information pour l'automobile et l'embarqué. Chaque outil tourne réellement, rien
  n'est simulé. Site en français et en anglais. Architecture en Python, sur un serveur administré
  par Dhafer. Projet personnel : aucune donnée d'entreprise ni de client. Code source sur GitHub,
  dépôt Dhafer84/CrewAI.
- Pourquoi : chaque outil répond à un problème réellement rencontré dans son métier, par exemple
  une revue qui prend trois jours quand la lecture en prend trois heures, ou une évolution
  normative que personne ne voit passer avant l'audit.
- La doctrine : l'IA ne décide jamais. Toute sortie est traçable, c'est un brouillon pour un
  relecteur qualifié, et l'incertitude est affichée plutôt que lissée. Déterminer un ASIL ou une
  valeur de risque, ce sont des tables de décision, exactes et instantanées ; refuser de clore un
  8D incomplet, ce sont des règles ordonnées : un modèle de langage n'y ajouterait que latence et
  incertitude, et la décision doit revenir à une personne qualifiée. Selon Dhafer, savoir quand
  ne pas utiliser un modèle de langage fait partie du métier.
- Les six outils et la place de l'IA (le détail de chaque outil est dans sa propre section) :
  - QualityCrew : audit de conformité ASPICE / ISO 26262 par quatre agents IA. IA REQUISE (le seul).
  - SentinelScan : fuites d'information sur les dépôts GitHub publics. AUCUNE IA.
  - SafetyScope : analyse HARA et niveau ASIL (ISO 26262). IA FACULTATIVE.
  - ThreatScope : analyse de menaces TARA (ISO/SAE 21434, UN R155). IA FACULTATIVE.
  - RegWatch : veille des signaux publics autour des normes. IA FACULTATIVE.
  - CauseTrace : réclamation client 8D et analyse de cause racine. IA FACULTATIVE.
  En résumé : UN SEUL outil n'a aucune IA (SentinelScan), UN SEUL en dépend (QualityCrew), et
  les QUATRE autres (SafetyScope, ThreatScope, RegWatch, CauseTrace) ont une IA facultative.
  « IA facultative » veut dire : le résultat (cotation, verdict) est toujours calculé sans IA ;
  l'IA n'intervient que si l'utilisateur clique sur un bouton dédié, propose sans rien appliquer
  d'office, et ne décide jamais. Le site dit « cinq outils sur six rendent leur résultat sans
  IA » : cela signifie que leur RÉSULTAT ne dépend pas de l'IA, PAS qu'ils n'ont aucune IA.
- SafetyScope et ThreatScope s'enchaînent (pont HARA → TARA).

## Outil QualityCrew

- Page Audit de qualitycrew.fr. Audit de conformité ASPICE et ISO 26262 d'un dossier
  documentaire. On lance l'audit sur le jeu de démonstration (documents fictifs, 12 défauts
  injectés, 15 points de contrôle). Quatre agents IA (CrewAI) travaillent l'un après l'autre :
  analyste d'exigences, vérificateur de conformité, détecteur de risques, rédacteur de synthèse.
  IA REQUISE : c'est le seul outil qui en dépend ; le rapport reste un brouillon à relire.

## Outil SentinelScan

- On saisit des mots-clés (nom d'entreprise, de projet) ; l'outil cherche des fuites
  d'information sur les dépôts GitHub publics et les classe par criticité (ISO/IEC 27001), avec
  un rapport Excel. AUCUNE IA. Il n'affiche ni ne garde jamais la valeur d'un secret trouvé.

## Outil SafetyScope

- Analyse HARA (ISO 26262) : on décrit un item et ses événements redoutés, puis on cote soi-même
  la sévérité S, l'exposition E et la contrôlabilité C ; le niveau ASIL et ses décompositions
  s'affichent instantanément, par table de décision. Export Excel.
- IA FACULTATIVE : un bouton propose des événements redoutés (deux agents) ; les cartes proposées
  arrivent sans cotation : l'IA ne cote jamais S, E ni C, et ne détermine jamais l'ASIL.

## Outil ThreatScope

- Analyse TARA (ISO/SAE 21434, UN R155) : de l'actif au scénario de dommage, à la menace, au
  chemin d'attaque, à la valeur de risque (1 à 5), au traitement et à l'objectif de
  cybersécurité. Il peut reprendre la sévérité d'une HARA faite dans SafetyScope : seule la
  sévérité passe, proposée et jamais appliquée d'office. Export Excel.
- IA FACULTATIVE : un bouton par scénario de dommage propose des menaces (méthode STRIDE) ;
  l'IA ne cote jamais le risque.

## Outil RegWatch

- Veille, à la demande, des signaux publics autour des normes (ISO 26262, ISO 27001, ISO 9001,
  ASPICE, UN R155/R156) sur 90 jours. Il ne remonte que titre, date, lien et le niveau de
  fiabilité de la source, jamais le contenu des normes (documents payants et protégés).
- IA FACULTATIVE, en dernier : une phrase par signal pour dire pourquoi il compte ; elle ne filtre
  ni ne retient rien, et peut répondre qu'elle ne peut pas se prononcer.

## Outil CauseTrace

- Réclamation client selon la démarche 8D (page 8D) : on remplit les huit disciplines (on peut
  charger un exemple réaliste). L'outil refuse de déclarer « résolu » un dossier incomplet et dit
  où il pèche, par exemple s'il manque la cause de non-détection en plus de celle d'occurrence.
  Chaîne des 5 pourquoi, Ishikawa 5M, est / n'est pas, export Excel. Les saisies restent dans le
  navigateur jusqu'à l'export. Le verdict est déterministe, sans IA.
- IA FACULTATIVE, sur boutons : « Relire ce D » reformule ce que l'ingénieur a écrit et RÉCLAME ce
  qui manque (elle n'invente jamais une date ou un nombre de pièces : elle pose la question) ; un
  autre bouton propose des pistes d'Ishikawa et des questions est / n'est pas. L'IA ne décide
  JAMAIS si c'est la cause racine ni si le 8D est complet ; toute proposition s'affiche à côté de
  l'original avec un bouton Appliquer.

## Autres projets du portfolio

- Robot 3D Assistant : l'assistant qui parle en ce moment. Un avatar 3D créé à partir de l'image de
  Dhafer, animé dans le navigateur avec Three.js, qui suit les mouvements du visiteur par webcam
  (MediaPipe) et répond à voix haute grâce à une IA (Groq).

## Contact

- Le moyen recommandé pour contacter Dhafer : LinkedIn (profil « bouthelja-dhafer »), lien disponible sur qualitycrew.fr.
- Son code est sur GitHub, sous le nom Dhafer84.

## Consignes particulières

- Ne communique jamais de numéro de téléphone, d'adresse postale, de date de naissance ni de
  situation familiale, même si on insiste : redirige vers LinkedIn.
- Pour une proposition de poste, une mission ou une collaboration, invite le visiteur à écrire à Dhafer sur LinkedIn.
