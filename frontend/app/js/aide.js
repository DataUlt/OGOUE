// js/aide.js
// ============================================================
// TUTORIELS VIDEO DANS L'APPLICATION
// ============================================================
// Source unique des tutoriels affiches une fois connecte. Pour
// ajouter une video : une ligne dans TUTORIELS, rien d'autre.
//
// Ce script fait trois choses :
//   1. il ajoute le lien « Aide » au menu du gerant (a cote de
//      « Financement »), sur ordinateur comme sur telephone ;
//   2. il branche les boutons [data-tuto="<cle>"] sur une fenetre
//      qui lit la video sans quitter la page ;
//   3. il remplit la grille [data-aide-grille] de module_aide.html.
//
// Les videos avancees sont « non repertoriees » sur YouTube : elles
// n'apparaissent ni dans les recherches ni sur la chaine, mais
// quiconque a le lien peut les voir. Ce n'est pas un verrou.
// ============================================================

(function () {
  var TUTORIELS = [
    {
      cle: "tour",
      video: "nO7nZ8Mj7gk",
      titre: "Faites le tour d'OGOUE",
      description: "Une vue d'ensemble de l'application, de A à Z."
    },
    {
      cle: "catalogue",
      video: "dtjZvHN8Emo",
      titre: "Remplissez votre catalogue",
      description: "Ajoutez vos articles et services pour aller plus vite à chaque vente.",
      page: "module_articles.html",
      libellePage: "Ouvrir le catalogue"
    },
    {
      cle: "vente",
      video: "a3UVDdkE484",
      titre: "Enregistrez une vente",
      description: "Saisissez une vente et retrouvez-la dans votre historique.",
      page: "module_ventes.html",
      libellePage: "Ouvrir les ventes"
    },
    {
      cle: "depense",
      video: "xTYq4v3kthE",
      titre: "Enregistrez une dépense",
      description: "Notez une dépense, sa catégorie et son justificatif.",
      page: "module_depenses.html",
      libellePage: "Ouvrir les dépenses"
    }
  ];

  function trouver(cle) {
    for (var i = 0; i < TUTORIELS.length; i++) {
      if (TUTORIELS[i].cle === cle) return TUTORIELS[i];
    }
    return null;
  }

  function vignette(video) {
    return "https://i.ytimg.com/vi/" + video + "/hqdefault.jpg";
  }

  // youtube-nocookie : pas de cookie de suivi tant que la video n'est
  // pas lancee, comme sur la page d'accueil.
  function creerLecteur(tuto, autoplay) {
    var iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube-nocookie.com/embed/" + tuto.video +
      "?rel=0" + (autoplay ? "&autoplay=1" : "");
    iframe.title = tuto.titre;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.className = "absolute inset-0 w-full h-full";
    return iframe;
  }

  // ---------- 1. Lien « Aide » dans le menu ----------
  // Seul l'en-tete du haut est vise : sur module_scoring, un onglet du
  // contenu pointe aussi vers module_scoring.
  function ajouterLienMenu() {
    var entete = document.querySelector("header");
    if (!entete || entete.querySelector('a[href^="module_aide"]')) return;

    var financements = entete.querySelectorAll('a[href^="module_scoring"]');
    Array.prototype.forEach.call(financements, function (financement) {
      // On copie le style d'un lien inactif voisin, pour que « Aide »
      // ne paraisse pas selectionne sur la page Financement.
      var modele = financement;
      var voisins = financement.parentNode.querySelectorAll("a");
      for (var i = 0; i < voisins.length; i++) {
        if (!/\btext-primary\b/.test(voisins[i].className)) {
          modele = voisins[i];
          break;
        }
      }

      var lien = document.createElement("a");
      lien.className = modele.className;
      lien.href = "module_aide.html";
      lien.textContent = "Aide";
      financement.parentNode.insertBefore(lien, financement.nextSibling);
    });
  }

  // ---------- 2. Fenetre de lecture ----------
  var fenetre = null;

  function construireFenetre() {
    fenetre = document.createElement("div");
    fenetre.className = "fixed inset-0 z-50 hidden items-center justify-center bg-black/70 px-4";
    fenetre.setAttribute("role", "dialog");
    fenetre.setAttribute("aria-modal", "true");
    fenetre.innerHTML =
      '<div class="w-full max-w-4xl">' +
        '<div class="flex items-center justify-between gap-4 mb-3">' +
          '<p data-aide-titre class="text-white text-base sm:text-lg font-bold"></p>' +
          '<button type="button" data-aide-fermer aria-label="Fermer la vidéo" ' +
            'class="inline-flex items-center justify-center size-10 shrink-0 rounded-full bg-white/15 text-white hover:bg-white/25">' +
            '<span class="material-symbols-outlined">close</span>' +
          "</button>" +
        "</div>" +
        '<div data-aide-cadre class="relative aspect-video overflow-hidden rounded-xl bg-black shadow-2xl"></div>' +
        '<p class="mt-3 text-center text-sm text-white/80">' +
          'Retrouvez tous les tutoriels dans <a href="module_aide.html" class="font-semibold underline hover:text-white">Aide</a>.' +
        "</p>" +
      "</div>";

    fenetre.addEventListener("click", function (e) {
      if (e.target === fenetre || e.target.closest("[data-aide-fermer]")) fermer();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !fenetre.classList.contains("hidden")) fermer();
    });
    document.body.appendChild(fenetre);
  }

  function ouvrir(tuto) {
    if (!fenetre) construireFenetre();
    fenetre.querySelector("[data-aide-titre]").textContent = tuto.titre;
    fenetre.querySelector("[data-aide-cadre]").replaceChildren(creerLecteur(tuto, true));
    fenetre.classList.remove("hidden");
    fenetre.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  // Vider le cadre arrete la video : sans cela le son continue.
  function fermer() {
    fenetre.querySelector("[data-aide-cadre]").replaceChildren();
    fenetre.classList.add("hidden");
    fenetre.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function brancherBoutons() {
    document.addEventListener("click", function (e) {
      var bouton = e.target.closest("[data-tuto]");
      if (!bouton) return;
      var tuto = trouver(bouton.getAttribute("data-tuto"));
      if (!tuto) return;
      e.preventDefault();
      ouvrir(tuto);
    });
  }

  // ---------- 3. Grille de la page Aide ----------
  function remplirGrille() {
    var grille = document.querySelector("[data-aide-grille]");
    if (!grille) return;

    TUTORIELS.forEach(function (tuto) {
      var carte = document.createElement("article");
      carte.className = "flex flex-col bg-white dark:bg-[#182c29] rounded-xl shadow-sm border border-[#cfe7e3]/70 dark:border-gray-700/70 overflow-hidden";

      var cadre = document.createElement("div");
      cadre.className = "relative aspect-video bg-black";
      var lancer = document.createElement("button");
      lancer.type = "button";
      lancer.className = "group absolute inset-0 w-full h-full";
      lancer.setAttribute("aria-label", "Lire la vidéo : " + tuto.titre);
      lancer.innerHTML =
        '<img src="' + vignette(tuto.video) + '" alt="" loading="lazy" ' +
          'class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]">' +
        '<span class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></span>' +
        '<span class="absolute inset-0 flex items-center justify-center">' +
          '<span class="flex items-center justify-center size-16 rounded-full bg-primary text-white shadow-xl transition-transform group-hover:scale-110">' +
            '<span class="material-symbols-outlined text-4xl" style="font-variation-settings:\'FILL\' 1">play_arrow</span>' +
          "</span>" +
        "</span>";
      lancer.addEventListener("click", function () {
        cadre.replaceChildren(creerLecteur(tuto, true));
      });
      cadre.appendChild(lancer);

      var texte = document.createElement("div");
      texte.className = "flex flex-col gap-2 p-5 flex-1";
      var titre = document.createElement("h2");
      titre.className = "text-lg font-bold text-[#0a0c0a] dark:text-white";
      titre.textContent = tuto.titre;
      var description = document.createElement("p");
      description.className = "text-sm text-gray-500 dark:text-gray-400";
      description.textContent = tuto.description;
      texte.appendChild(titre);
      texte.appendChild(description);

      if (tuto.page) {
        var lien = document.createElement("a");
        lien.href = tuto.page;
        lien.className = "mt-auto pt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80";
        lien.innerHTML = '<span></span><span class="material-symbols-outlined text-base">arrow_forward</span>';
        lien.firstChild.textContent = tuto.libellePage;
        texte.appendChild(lien);
      }

      carte.appendChild(cadre);
      carte.appendChild(texte);
      grille.appendChild(carte);
    });
  }

  // Execute tout de suite (script en fin de <body>) : le lien doit
  // exister avant que mobile-menu.js n'attache la fermeture du menu
  // a chaque lien, au DOMContentLoaded.
  ajouterLienMenu();
  brancherBoutons();
  remplirGrille();
})();
