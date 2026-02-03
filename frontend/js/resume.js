console.log('resume.js loaded!');

// Resume Page Functionality
window.OGOUE = window.OGOUE || {};

window.OGOUE.resumePage = {
    init: function() {
        console.log('Resume page init started');
        this.loadRepartitionVentes();
        this.loadRepartitionDepenses();
        console.log('Resume page init completed');
    },
    
    loadRepartitionVentes: function() {
        const container = document.getElementById('repartition-ventes');
        console.log('repartition-ventes container:', container);
        if (!container) return;
        
        const data = [
            { label: 'Iphone 17', amount: '200 000 FCFA', percentage: 67.6 },
            { label: 'Robe', amount: '52 700 FCFA', percentage: 17.8 },
            { label: 'Robe harmonie', amount: '30 500 FCFA', percentage: 10.3 },
            { label: 'rOBE', amount: '12 500 FCFA', percentage: 4.2 }
        ];
        
        let html = '<div class="flex flex-col">';
        data.forEach((item, index) => {
            const isLast = index === data.length - 1;
            html += `
                <div class="flex items-center justify-between gap-4 h-20 ${!isLast ? 'border-b border-gray-300 dark:border-gray-600' : ''}">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${item.label}</p>
                        <p class="text-base font-bold text-gray-900 dark:text-white">${item.amount}</p>
                    </div>
                    <div class="flex-shrink-0 ml-4">
                        <div class="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center text-gray-700 dark:text-gray-100 font-bold text-xs">
                            ${item.percentage}%
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        console.log('Repartition ventes loaded');
    },
    
    loadRepartitionDepenses: function() {
        const container = document.getElementById('repartition-depenses');
        console.log('repartition-depenses container:', container);
        if (!container) return;
        
        const data = [
            { label: 'Fournitures', amount: '25 000 FCFA', percentage: 35 },
            { label: 'Transport', amount: '15 000 FCFA', percentage: 21 },
            { label: 'Repas', amount: '20 000 FCFA', percentage: 28 },
            { label: 'Autres', amount: '12 000 FCFA', percentage: 16 }
        ];
        
        let html = '<div class="flex flex-col">';
        data.forEach((item, index) => {
            const isLast = index === data.length - 1;
            html += `
                <div class="flex items-center justify-between gap-4 h-20 ${!isLast ? 'border-b border-gray-300 dark:border-gray-600' : ''}">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${item.label}</p>
                        <p class="text-base font-bold text-gray-900 dark:text-white">${item.amount}</p>
                    </div>
                    <div class="flex-shrink-0 ml-4">
                        <div class="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-500 flex items-center justify-center text-gray-700 dark:text-gray-100 font-bold text-xs">
                            ${item.percentage}%
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        console.log('Repartition depenses loaded');
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - calling resumePage.init');
    window.OGOUE.resumePage.init();
});
