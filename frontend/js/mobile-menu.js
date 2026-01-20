console.log('mobile-menu.js loaded!');

document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    console.log('DOMContentLoaded fired');
    console.log('menuToggle found:', !!menuToggle);
    console.log('mobileMenu found:', !!mobileMenu);
    
    if (menuToggle && mobileMenu) {
        console.log('Both elements found, adding click listener');
        menuToggle.addEventListener('click', function() {
            console.log('Menu toggle clicked!');
            console.log('Before toggle - has hidden:', mobileMenu.classList.contains('hidden'));
            mobileMenu.classList.toggle('hidden');
            console.log('After toggle - has hidden:', mobileMenu.classList.contains('hidden'));
        });
        
        // Fermer le menu quand on clique sur un lien
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.add('hidden');
            });
        });
    } else {
        console.log('ERROR: Menu elements not found!');
        console.log('menuToggle:', menuToggle);
        console.log('mobileMenu:', mobileMenu);
    }
});

