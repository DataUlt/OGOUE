// js/session.js — garder le gérant connecté tant qu'il se sert d'OGOUE
// ============================================================
// Le jeton de connexion d'un gérant (Supabase) expire au bout d'une heure.
// À la connexion, le site garde aussi le jeton de prolongation (ogo_session) ;
// ce script renouvelle la session en arrière-plan :
//   - quelques minutes avant l'expiration, et au retour sur l'application ;
//   - si un appel au serveur tombe quand même sur une session expirée (401),
//     la session est renouvelée et l'appel refait, sans renvoi vers la connexion.
// Les agents (jeton OGOUE de 24 h, sans prolongation) ne sont pas concernés :
// ogo_session n'existe que pour le jeton qu'il accompagne.
// Chargé dans le <head>, avant tout autre script qui appelle le serveur.
// ============================================================
(function () {
  var CLE = "ogo_session";
  var MARGE_S = 5 * 60;   // renouveler 5 minutes avant l'expiration
  var h = location.hostname;
  var API = ["localhost", "127.0.0.1"].some(function (x) { return h.indexOf(x) >= 0; })
    ? "http://localhost:3001"
    : /^192\.168\./.test(h) ? "http://" + h + ":3001" : "https://api.ogoue.com";

  function lire() {
    try {
      var s = JSON.parse(localStorage.getItem(CLE) || "null");
      // La prolongation ne vaut que pour le jeton avec lequel elle a été rangée
      // (un agent connecté ensuite sur le même téléphone a un autre jeton)
      return s && s.refresh && s.access === localStorage.getItem("authToken") ? s : null;
    } catch (e) { return null; }
  }
  function expiration(jeton) {
    try {
      var p = jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(p)).exp || 0;
    } catch (e) { return 0; }
  }
  var maintenant = function () { return Math.floor(Date.now() / 1000); };
  var expireBientot = function (s) { return expiration(s.access) - maintenant() < MARGE_S; };

  var fetchOrigine = window.fetch.bind(window);
  var enCours = null;
  var minuterie = null;

  // Un seul renouvellement à la fois, même si plusieurs appels le demandent
  function renouveler() {
    var s = lire();
    if (!s) return Promise.resolve(false);
    if (enCours) return enCours;
    enCours = fetchOrigine(API + "/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: s.refresh })
    }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (d) {
      if (!d || !d.token || !d.refreshToken) {
        // Prolongation refusée (session révoquée) : la page gère le 401 comme avant
        if (lire() && lire().refresh === s.refresh) localStorage.removeItem(CLE);
        return false;
      }
      // Rien n'a changé entre-temps (déconnexion, autre compte) : on range la nouvelle session
      if (localStorage.getItem("authToken") !== s.access) return false;
      localStorage.setItem("authToken", d.token);
      localStorage.setItem(CLE, JSON.stringify({ access: d.token, refresh: d.refreshToken }));
      programmer();
      return true;
    }).catch(function () {
      return false;   // pas de réseau : on réessaiera au prochain appel
    }).then(function (ok) {
      enCours = null;
      return ok;
    });
    return enCours;
  }

  function programmer() {
    clearTimeout(minuterie);
    var s = lire();
    if (!s) return;
    var dans = (expiration(s.access) - maintenant() - MARGE_S) * 1000;
    minuterie = setTimeout(renouveler, Math.max(0, Math.min(dans, 2147483000)));
  }

  // Appels au serveur : session renouvelée avant si elle expire, et après un 401 imprévu
  window.fetch = function (entree, options) {
    var url = typeof entree === "string" ? entree : (entree && entree.url) || "";
    var s = lire();
    if (!s || url.indexOf(API) !== 0 || url.indexOf("/api/auth/") >= 0 || typeof entree !== "string") {
      return fetchOrigine(entree, options);
    }
    options = options || {};
    var avecJeton = function () {
      var entetes = new Headers(options.headers || {});
      var actuel = entetes.get("Authorization");
      // Seul le jeton de la session est remplacé, jamais un autre en-tête
      if (actuel && actuel.indexOf("Bearer ") === 0) entetes.set("Authorization", "Bearer " + localStorage.getItem("authToken"));
      return Object.assign({}, options, { headers: entetes });
    };
    var aJeton = new Headers(options.headers || {}).get("Authorization");
    if (!aJeton) return fetchOrigine(entree, options);

    var avant = expireBientot(s) ? renouveler() : Promise.resolve(true);
    return avant.then(function () {
      return fetchOrigine(entree, avecJeton());
    }).then(function (r) {
      if (r.status !== 401) return r;
      return renouveler().then(function (ok) {
        return ok ? fetchOrigine(entree, avecJeton()) : r;
      });
    });
  };

  // Téléphone mis en veille puis rouvert des heures plus tard : renouveler tout de suite
  document.addEventListener("visibilitychange", function () {
    var s = lire();
    if (!document.hidden && s && expireBientot(s)) renouveler();
  });

  window.OGOUE_SESSION = { renouveler: renouveler };
  programmer();
})();
