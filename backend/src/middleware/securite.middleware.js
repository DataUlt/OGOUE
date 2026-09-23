/**
 * En-tetes de securite et limitation du debit.
 *
 * Ecrits a la main plutot que d'ajouter helmet et express-rate-limit :
 * ce dont l'application a besoin tient en quelques lignes, et le projet
 * s'est deja donne pour regle de ne pas embarquer une dependance de
 * plusieurs centaines de kilo-octets pour une poignee de fonctions.
 */

/**
 * En-tetes appliques a toutes les reponses.
 *
 * Pas de Content-Security-Policy ici : le frontend charge Tailwind
 * depuis un CDN et utilise des scripts en ligne, une CSP stricte
 * casserait toutes les pages. Elle merite d'etre posee, mais apres un
 * vrai passage sur le frontend, pas au detour d'un correctif.
 */
export function enTetesSecurite(req, res, next) {
  // Empeche le navigateur de deviner un type MIME : un fichier annonce
  // en texte ne sera pas execute comme du script.
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Interdit l'affichage du site dans une iframe tierce, donc le
  // clickjacking : une page pirate ne peut pas superposer ses boutons
  // aux notres.
  res.setHeader("X-Frame-Options", "DENY");

  // Ne divulgue pas l'URL d'origine aux sites tiers. Les URL signees des
  // justificatifs transitent dans la barre d'adresse : sans cela, elles
  // partiraient dans le Referer du premier lien externe clique.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Aucune de ces fonctions n'est utilisee par l'application.
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Impose HTTPS pendant un an. En local le navigateur l'ignore sur
  // http://localhost, il n'y a donc pas de risque de s'y enfermer.
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // express annonce sa presence par defaut : autant ne pas indiquer la
  // pile a qui cherche une version vulnerable.
  res.removeHeader("X-Powered-By");

  next();
}

/**
 * Limitation du nombre de tentatives, par adresse IP.
 *
 * Rien ne freinait les essais de mot de passe ni les essais de code
 * d'acces agent. Un code fait neuf caracteres sur un alphabet de 32 :
 * sans limite, une machine en essaie des millions, et il n'y a ni
 * verrouillage de compte ni alerte pour s'en apercevoir.
 *
 * Le compteur vit en memoire. Sur plusieurs instances chacune aurait le
 * sien, ce qui multiplie le plafond par leur nombre — tres insuffisant
 * pour une banque, largement suffisant pour transformer une attaque de
 * quelques heures en une attaque de plusieurs annees.
 *
 * @param {number} max      tentatives autorisees par fenetre
 * @param {number} fenetreMs duree de la fenetre
 * @param {string} message  ce que voit l'appelant une fois bloque
 */
export function limiterTentatives(max, fenetreMs, message) {
  const compteurs = new Map();

  // Sans purge, la table grossit d'une entree par adresse vue et ne
  // redescend jamais : une fuite de memoire lente, et un levier de deni
  // de service pour qui fait varier son IP.
  const purger = () => {
    const maintenant = Date.now();
    for (const [cle, valeur] of compteurs) {
      if (valeur.expire <= maintenant) compteurs.delete(cle);
    }
  };
  const minuteur = setInterval(purger, fenetreMs);
  // Ne retient pas le processus a l'arret.
  if (typeof minuteur.unref === "function") minuteur.unref();

  return function (req, res, next) {
    // Render place l'adresse reelle dans X-Forwarded-For ; on prend le
    // premier maillon, les suivants etant ajoutes par les relais.
    const brut = req.headers["x-forwarded-for"];
    const ip = (typeof brut === "string" ? brut.split(",")[0].trim() : null)
      || req.socket?.remoteAddress
      || "inconnue";

    const maintenant = Date.now();
    const entree = compteurs.get(ip);

    if (!entree || entree.expire <= maintenant) {
      compteurs.set(ip, { nombre: 1, expire: maintenant + fenetreMs });
      return next();
    }

    entree.nombre += 1;

    if (entree.nombre > max) {
      const secondes = Math.ceil((entree.expire - maintenant) / 1000);
      res.setHeader("Retry-After", String(secondes));
      return res.status(429).json({
        error: message,
        code: "trop_de_tentatives",
        reessayerDansSecondes: secondes,
      });
    }

    return next();
  };
}
