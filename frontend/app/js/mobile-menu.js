// Mobile Menu Toggle Script

// Sur téléphone : le logo s'aligne sur le texte de la page (l'image a une
// marge transparente d'environ 44 px à gauche), et les trois traits du
// menu se placent au milieu de l'en-tête.
(function () {
    const style = document.createElement('style');
    style.textContent =
        '@media (max-width: 767px) {' +
        // Taille d'origine (comme sur la page Articles) : sans « max-width: none »,
        // le logo se laisse écraser en largeur pour faire place au menu
        '  header:has(#menu-toggle) img[alt*="Logo"] { margin-left: -42px; max-width: none; }' +
        '  header:has(#menu-toggle) #menu-toggle { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }' +
        '}';
    document.head.appendChild(style);
})();

document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
        
        // Fermer le menu quand on clique sur un lien
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.add('hidden');
            });
        });
    }
});
