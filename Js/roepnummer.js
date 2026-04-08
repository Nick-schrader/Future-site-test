// Roepnummer Bestand - JavaScript Functionaliteit
let personeelData = [];
let currentUser = null;

// Rang definities met roepnummer ranges
const rangDefinities = {
    '4e klasse': { min: '56-81', max: '56-140', categorie: 'manschappen' },
    '3e klasse': { min: '56-41', max: '56-80', categorie: 'manschappen' },
    '2e klasse': { min: '56-21', max: '56-40', categorie: 'manschappen' },
    '1e klasse': { min: '56-01', max: '56-20', categorie: 'manschappen' },
    'wachtmeester': { min: '55-41', max: '55-60', categorie: 'korporaals' },
    'wachtmeester 1e klasse': { min: '55-25', max: '55-48', categorie: 'korporaals' },
    'opperwachtmeester': { min: '55-01', max: '55-24', categorie: 'korporaals' },
    'adjudant-onderofficier': { min: '54-09', max: '54-23', categorie: 'onderofficieren' },
    'kornet': { min: '54-01', max: '54-08', categorie: 'onderofficieren' },
    'tweede luitenant': { min: '53-06', max: '53-12', categorie: 'officieren' },
    'eerste luitenant': { min: '53-04', max: '53-05', categorie: 'officieren' },
    'kapitein': { min: '53-01', max: '53-03', categorie: 'officieren' },
    'majoor': { min: '52-07', max: '52-09', categorie: 'hoofdofficieren' },
    'luitenant-kolonel': { min: '52-04', max: '52-06', categorie: 'hoofdofficieren' },
    'kolonel': { min: '52-01', max: '52-03', categorie: 'hoofdofficieren' },
    'brigade-generaal': { min: '51-04', max: '51-06', categorie: 'kader' },
    'generaal-majoor': { min: '51-02', max: '51-03', categorie: 'kader' },
    'luitenant-generaal': { min: '51-01', max: '51-01', categorie: 'kader' }
};

// Rang hiërarchie voor promotie/demotion
const rangHiërarchie = [
    '4e klasse', '3e klasse', '2e klasse', '1e klasse',
    'wachtmeester', 'wachtmeester 1e klasse', 'opperwachtmeester',
    'adjudant-onderofficier', 'kornet',
    'tweede luitenant', 'eerste luitenant', 'kapitein',
    'majoor', 'luitenant-kolonel', 'kolonel',
    'brigade-generaal', 'generaal-majoor', 'luitenant-generaal'
];

// Categorie data
const categorieData = {
    'manschappen': ['4e klasse', '3e klasse', '2e klasse', '1e klasse'],
    'korporaals': ['korporaal', 'korporaal der 1e klasse', 'sergeant', 'sergeant der 1e klasse'],
    'onderofficieren': ['adjudant-onderofficier', 'kornet'],
    'officieren': ['tweede luitenant', 'eerste luitenant', 'kapitein'],
    'hoofdofficieren': ['majoor', 'luitenant-kolonel', 'kolonel'],
    'kader': ['brigade-generaal', 'generaal-majoor', 'luitenant-generaal']
};

// Huidige geselecteerde categorie
let huidigeCategorie = 'manschappen';

// Helper functie om user data te krijgen
function getUser() {
    try {
        // Probeer eerst localStorage, dan sessionStorage
        const localUser = localStorage.getItem('user');
        if (localUser) {
            return JSON.parse(localUser);
        }
        
        const sessionUser = sessionStorage.getItem('user');
        if (sessionUser && sessionUser !== 'null' && sessionUser !== 'undefined') {
            return JSON.parse(sessionUser);
        }
        
        return {};
    } catch (e) {
        return {};
    }
}

// Initialiseer de pagina
document.addEventListener('DOMContentLoaded', function() {
    // Permissie check verwijderd - pagina altijd zichtbaar
    toonRoepnummerPagina();
    laadPersoneel();
    setupEventListeners();
});

// Toon de pagina - geen permissie check nodig
function toonRoepnummerPagina() {
    const container = document.querySelector('.roepnummer-container');
    const geenToegang = document.querySelector('.geen-toegang');
    
    if (container) container.style.display = 'block';
    if (geenToegang) geenToegang.style.display = 'none';
}

// Setup event listeners
function setupEventListeners() {
    // Check admin permissies - toon knop voor iedereen (demo mode)
    const nieuwePersoneelBtn = document.getElementById('nieuwePersoneelBtn');
    if (nieuwePersoneelBtn) {
        nieuwePersoneelBtn.style.display = 'inline-block';
        nieuwePersoneelBtn.addEventListener('click', openNieuwePersoneelModal);
    }
    
    // Categorie selectie dropdown
    const categorieSelect = document.getElementById('categorieSelect');
    if (categorieSelect) {
        // Zet default waarde naar manschappen
        categorieSelect.value = 'manschappen';
        
        categorieSelect.addEventListener('change', function() {
            huidigeCategorie = this.value;
            filterCategorie();
        });
        
        // Trigger initial filter
        setTimeout(() => filterCategorie(), 100);
    }
    
    // Zoekfunctie
    const zoekInput = document.getElementById('zoekInput');
    const zoekBtn = document.getElementById('zoekBtn');
    
    if (zoekInput && zoekBtn) {
        // Real-time zoeken
        zoekInput.addEventListener('input', function() {
            zoekPersoneel();
        });
        
        // Zoek op enter
        zoekInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                zoekPersoneel();
            }
        });
        
        // Zoek op knop klik
        zoekBtn.addEventListener('click', function() {
            zoekPersoneel();
        });
    }
    
    // Zoek personeel functie
    function zoekPersoneel() {
        const zoekTerm = zoekInput.value.toLowerCase().trim();
        
        if (!zoekTerm) {
            // Toon alles als zoekterm leeg is
            document.querySelectorAll('.personeel-rij').forEach(rij => {
                rij.style.display = 'flex';
                // Reset highlighting
                resetHighlighting(rij);
            });
            return;
        }
        
        // Zoek in alle personeels
        personeelData.forEach(personeel => {
            const rij = document.querySelector(`[data-personeel-id="${personeel.id}"]`);
            if (rij) {
                const naamMatch = personeel.naam.toLowerCase().includes(zoekTerm);
                const roepnummerMatch = personeel.roepnummer && personeel.roepnummer.toLowerCase().includes(zoekTerm);
                const discordMatch = personeel.discordId && personeel.discordId.toLowerCase().includes(zoekTerm);
                
                if (naamMatch || roepnummerMatch || discordMatch) {
                    rij.style.display = 'flex';
                    // Highlight de gevonden tekst
                    highlightZoekTerm(rij, zoekTerm);
                } else {
                    rij.style.display = 'none';
                    // Reset highlighting als niet gevonden
                    resetHighlighting(rij);
                }
            }
        });
    }
    
    // Highlight zoekterm in tekst
    function highlightZoekTerm(element, zoekTerm) {
        const naamElement = element.querySelector('.personeel-naam');
        const discordElement = element.querySelector('.personeel-discord');
        
        if (naamElement) {
            const naamTekst = naamElement.textContent;
            const highlightedNaam = highlightTekst(naamTekst, zoekTerm);
            naamElement.innerHTML = highlightedNaam;
        }
        
        if (discordElement) {
            const discordTekst = discordElement.textContent;
            const highlightedDiscord = highlightTekst(discordTekst, zoekTerm);
            discordElement.innerHTML = highlightedDiscord;
        }
    }
    
    // Highlight tekst functie
    function highlightTekst(tekst, zoekTerm) {
        const regex = new RegExp(`(${zoekTerm})`, 'gi');
        return tekst.replace(regex, '<mark style="background: #fbbf24; color: #1f2937; padding: 2px; border-radius: 2px;">$1</mark>');
    }
    
    // Reset highlighting functie
    function resetHighlighting(element) {
        const naamElement = element.querySelector('.personeel-naam');
        const discordElement = element.querySelector('.personeel-discord');
        
        if (naamElement) {
            // Reset naar originele tekst zonder highlighting
            naamElement.innerHTML = naamElement.textContent;
        }
        
        if (discordElement) {
            // Reset naar originele tekst zonder highlighting
            discordElement.innerHTML = discordElement.textContent;
        }
    }
    
    // Modal sluiten
    const nieuwePersoneelModal = document.getElementById('nieuwePersoneelModal');
    if (nieuwePersoneelModal) {
        nieuwePersoneelModal.addEventListener('click', function(e) {
            if (e.target === this) sluitModal();
        });
    }
    
        
    // Setup dropdowns en zoekfuncties per rang categorie
    setupRangCategorieInteractie();
    
    // Setup drag and drop voor alle personeel lijsten
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        setupDragAndDrop(lijst);
    });
}


// Setup dropdowns en zoekfuncties per rang categorie
function setupRangCategorieInteractie() {
    document.querySelectorAll('.rang-categorie').forEach(categorie => {
        const titel = categorie.querySelector('.categorie-titel');
        const secties = categorie.querySelectorAll('.rang-sectie');
        
        // Maak dropdown toggle
        const dropdownToggle = document.createElement('div');
        dropdownToggle.className = 'dropdown-toggle';
        dropdownToggle.innerHTML = '<span class="material-icons">expand_more</span>';
        dropdownToggle.style.cssText = `
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            transition: transform 0.3s ease;
            color: white;
            font-size: 1.2rem;
            z-index: 10;
        `;
        
        titel.parentElement.appendChild(dropdownToggle);
        
        // Voeg zoekfunctie toe
        const zoekContainer = document.createElement('div');
        zoekContainer.className = 'zoek-container';
        zoekContainer.innerHTML = `
            <input type="text" class="zoek-input" placeholder="Zoek personeel...">
            <span class="material-icons zoek-icon">search</span>
        `;
        zoekContainer.style.cssText = `
            margin: 10px 15px;
            position: relative;
        `;
        
        const zoekInput = zoekContainer.querySelector('.zoek-input');
        zoekInput.style.cssText = `
            width: 100%;
            padding: 10px 40px 10px 15px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            color: white;
            font-size: 0.9rem;
            outline: none;
            transition: all 0.3s ease;
        `;
        
        const zoekIcon = zoekContainer.querySelector('.zoek-icon');
        zoekIcon.style.cssText = `
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: rgba(255,255,255,0.6);
            font-size: 1.2rem;
        `;
        
        categorie.insertBefore(zoekContainer, categorie.querySelector('.rang-sectie'));
        
        // Dropdown toggle functionaliteit
        let isExpanded = true;
        dropdownToggle.addEventListener('click', function() {
            isExpanded = !isExpanded;
            this.style.transform = isExpanded ? 'translateY(-50%)' : 'translateY(-50%) rotate(180deg)';
            
            secties.forEach(sectie => {
                sectie.style.display = isExpanded ? 'block' : 'none';
            });
        });
        
        // Zoekfunctionaliteit
        zoekInput.addEventListener('input', function() {
            const zoekTerm = this.value.toLowerCase();
            
            secties.forEach(sectie => {
                const personeelLijst = sectie.querySelector('.personeel-lijst');
                const personeelRijen = personeelLijst.querySelectorAll('.personeel-rij');
                
                let hasVisibleRijen = false;
                
                personeelRijen.forEach(rij => {
                    const naam = rij.querySelector('.personeel-naam')?.textContent.toLowerCase() || '';
                    const discord = rij.querySelector('.personeel-discord')?.textContent.toLowerCase() || '';
                    const roepnummer = rij.querySelector('.personeel-roepnummer')?.textContent.toLowerCase() || '';
                    
                    if (naam.includes(zoekTerm) || discord.includes(zoekTerm) || roepnummer.includes(zoekTerm)) {
                        rij.style.display = 'flex';
                        hasVisibleRijen = true;
                    } else {
                        rij.style.display = 'none';
                    }
                });
                
                // Toon/verberg sectie op basis van zoekresultaten
                if (zoekTerm === '') {
                    sectie.style.display = isExpanded ? 'block' : 'none';
                } else {
                    sectie.style.display = hasVisibleRijen ? 'block' : 'none';
                }
            });
        });
        
        // Focus styles voor zoekinput
        zoekInput.addEventListener('focus', function() {
            this.style.background = 'rgba(255,255,255,0.15)';
            this.style.borderColor = 'rgba(255,255,255,0.4)';
        });
        
        zoekInput.addEventListener('blur', function() {
            this.style.background = 'rgba(255,255,255,0.1)';
            this.style.borderColor = 'rgba(255,255,255,0.2)';
        });
    });
}

// Setup drag and drop voor een personeel lijst
function setupDragAndDrop(lijst) {
    lijst.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    });
    
    lijst.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });
    
    lijst.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        const personeelId = e.dataTransfer.getData('personeelId');
        const nieuweRang = this.dataset.rang;
        
        if (personeelId && nieuweRang) {
            promoveerPersoneel(personeelId, nieuweRang);
        }
    });
}

// Laad personeel data
async function laadPersoneel() {
    try {
        const response = await fetch(`${API_URL}/api/roepnummer-bestand`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        personeelData = data;
        renderPersoneel();
    } catch (error) {
        console.error('Fout bij laden personeel:', error);
        // Toon lege maar mooie pagina - geen personeel beschikbaar
        personeelData = [];
        renderPersoneel();
    }
}

// Fallback personeel data met alle roepnummers
function getFallbackPersoneelData() {
    const data = [];
    
    // Manschappen
    for (let i = 81; i <= 140; i++) {
        data.push({
            id: `pers-4e-${i}`,
            naam: `Personeel 4e Klasse ${i}`,
            discord: `user${i}`,
            roepnummer: `56-${i}`,
            rang: '4e klasse'
        });
    }
    
    for (let i = 41; i <= 80; i++) {
        data.push({
            id: `pers-3e-${i}`,
            naam: `Personeel 3e Klasse ${i}`,
            discord: `user${i}`,
            roepnummer: `56-${i}`,
            rang: '3e klasse'
        });
    }
    
    for (let i = 21; i <= 40; i++) {
        data.push({
            id: `pers-2e-${i}`,
            naam: `Personeel 2e Klasse ${i}`,
            discord: `user${i}`,
            roepnummer: `56-${i}`,
            rang: '2e klasse'
        });
    }
    
    for (let i = 1; i <= 20; i++) {
        data.push({
            id: `pers-1e-${i}`,
            naam: `Personeel 1e Klasse ${i}`,
            discord: `user${i}`,
            roepnummer: `56-${String(i).padStart(2, '0')}`,
            rang: '1e klasse'
        });
    }
    
    // Korporaals
    for (let i = 41; i <= 60; i++) {
        data.push({
            id: `pers-wm-${i}`,
            naam: `Wachtmeester ${i}`,
            discord: `wm${i}`,
            roepnummer: `55-${i}`,
            rang: 'wachtmeester'
        });
    }
    
    for (let i = 25; i <= 48; i++) {
        data.push({
            id: `pers-wm1-${i}`,
            naam: `Wachtmeester 1e Klasse ${i}`,
            discord: `wm1${i}`,
            roepnummer: `55-${i}`,
            rang: 'wachtmeester 1e klasse'
        });
    }
    
    for (let i = 1; i <= 24; i++) {
        data.push({
            id: `pers-ow-${i}`,
            naam: `Opperwachtmeester ${i}`,
            discord: `ow${i}`,
            roepnummer: `55-${String(i).padStart(2, '0')}`,
            rang: 'opperwachtmeester'
        });
    }
    
    // Onderofficieren
    for (let i = 9; i <= 23; i++) {
        data.push({
            id: `pers-adj-${i}`,
            naam: `Adjudant-Onderofficier ${i}`,
            discord: `adj${i}`,
            roepnummer: `54-${i}`,
            rang: 'adjudant-onderofficier'
        });
    }
    
    for (let i = 1; i <= 8; i++) {
        data.push({
            id: `pers-kornet-${i}`,
            naam: `Kornet ${i}`,
            discord: `kornet${i}`,
            roepnummer: `54-0${i}`,
            rang: 'kornet'
        });
    }
    
    // Officieren
    for (let i = 6; i <= 12; i++) {
        data.push({
            id: `pers-2lt-${i}`,
            naam: `Tweede Luitenant ${i}`,
            discord: `2lt${i}`,
            roepnummer: `53-${i}`,
            rang: 'tweede luitenant'
        });
    }
    
    for (let i = 4; i <= 5; i++) {
        data.push({
            id: `pers-1lt-${i}`,
            naam: `Eerste Luitenant ${i}`,
            discord: `1lt${i}`,
            roepnummer: `53-0${i}`,
            rang: 'eerste luitenant'
        });
    }
    
    for (let i = 1; i <= 3; i++) {
        data.push({
            id: `pers-kap-${i}`,
            naam: `Kapitein ${i}`,
            discord: `kap${i}`,
            roepnummer: `53-0${i}`,
            rang: 'kapitein'
        });
    }
    
    // Hoofdofficieren
    for (let i = 7; i <= 9; i++) {
        data.push({
            id: `pers-maj-${i}`,
            naam: `Majoor ${i}`,
            discord: `maj${i}`,
            roepnummer: `52-0${i}`,
            rang: 'majoor'
        });
    }
    
    for (let i = 4; i <= 6; i++) {
        data.push({
            id: `pers-ltk-${i}`,
            naam: `Luitenant-Kolonel ${i}`,
            discord: `ltk${i}`,
            roepnummer: `52-0${i}`,
            rang: 'luitenant-kolonel'
        });
    }
    
    for (let i = 1; i <= 3; i++) {
        data.push({
            id: `pers-kol-${i}`,
            naam: `Kolonel ${i}`,
            discord: `kol${i}`,
            roepnummer: `52-0${i}`,
            rang: 'kolonel'
        });
    }
    
    // Kader
    for (let i = 4; i <= 6; i++) {
        data.push({
            id: `pers-brig-${i}`,
            naam: `Brigade-Generaal ${i}`,
            discord: `brig${i}`,
            roepnummer: `51-0${i}`,
            rang: 'brigade-generaal'
        });
    }
    
    for (let i = 2; i <= 3; i++) {
        data.push({
            id: `pers-genmaj-${i}`,
            naam: `Generaal-Majoor ${i}`,
            discord: `genmaj${i}`,
            roepnummer: `51-0${i}`,
            rang: 'generaal-majoor'
        });
    }
    
    data.push({
        id: `pers-ltg-1`,
        naam: `Luitenant-Generaal`,
        discord: `ltg`,
        roepnummer: `51-01`,
        rang: 'luitenant-generaal'
    });
    
    return data;
}

// Render personeel in de juiste rang secties
function renderPersoneel() {
    // Clear alle personeel lijsten
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        lijst.innerHTML = '';
    });
    
    // Voeg personeel toe
    personeelData.forEach(personeel => {
        const rangSectie = document.querySelector(`.personeel-lijst[data-rang="${personeel.rang}"]`);
        if (rangSectie) {
            rangSectie.appendChild(createPersoneelRij(personeel));
        }
    });
    
    // Toon placeholders voor lege rangen
    toonPlaceholdersVoorLegeRangen();
}

// Filter categorieën op basis van selectie
function filterCategorie() {
    const categorieContainer = document.querySelector('.rang-categorie-container');
    if (!categorieContainer) return;
    
    // Toon/verberg categorieën op basis van selectie
    const categorieën = categorieContainer.querySelectorAll('.rang-categorie');
    
    categorieën.forEach(categorie => {
        const categorieNaam = categorie.querySelector('.categorie-titel').textContent.toLowerCase();
        const categorieKey = getCategorieKey(categorieNaam);
        
        if (huidigeCategorie === 'alle') {
            categorie.style.display = 'block';
        } else if (categorieKey === huidigeCategorie) {
            categorie.style.display = 'block';
        } else {
            categorie.style.display = 'none';
        }
    });
    
    // Centreer de zichtbare categorieën
    centreerZichtbareCategorieën();
}

// Helper functie om categorie key te krijgen
function getCategorieKey(categorieNaam) {
    const mapping = {
        'manschappen': 'manschappen',
        'korporaals': 'korporaals',
        'onderofficieren': 'onderofficieren',
        'officieren': 'officieren',
        'hoofdofficieren': 'hoofdofficieren',
        'kader': 'kader'
    };
    return mapping[categorieNaam] || categorieNaam;
}

// Centreer zichtbare categorieën
function centreerZichtbareCategorieën() {
    const categorieContainer = document.querySelector('.rang-categorie-container');
    if (!categorieContainer) return;
    
    const zichtbareCategorieën = categorieContainer.querySelectorAll('.rang-categorie[style="display: block;"]');
    
    if (zichtbareCategorieën.length > 0) {
        // Voor elke zichtbare categorie: rangen horizontaal maken
        zichtbareCategorieën.forEach(categorie => {
            const rangSecties = categorie.querySelectorAll('.rang-sectie');
            
            if (rangSecties.length > 1) {
                // Maak container voor rangen als die niet bestaat
                let rangenContainer = categorie.querySelector('.rang-secties-container');
                if (!rangenContainer) {
                    rangenContainer = document.createElement('div');
                    rangenContainer.className = 'rang-secties-container';
                    
                    // Verplaats alle rang secties naar container
                    rangSecties.forEach(rang => {
                        rangenContainer.appendChild(rang);
                    });
                    
                    // Voeg container toe na header
                    const header = categorie.querySelector('.categorie-header');
                    if (header) {
                        header.insertAdjacentElement('afterend', rangenContainer);
                    } else {
                        categorie.appendChild(rangenContainer);
                    }
                }
                
                // Sorteer rangen in juiste volgorde
                sorteerRangenInCategorie(rangenContainer);
            }
        });
    }
}

// Sorteer rangen in juiste volgorde binnen categorie
function sorteerRangenInCategorie(categorie) {
    const rangSecties = categorie.querySelectorAll('.rang-sectie');
    const rangVolgorde = {
        '1e klasse': 1,
        '2e klasse': 2,
        '3e klasse': 3,
        '4e klasse': 4,
        'korporaal': 5,
        'korporaal der 1e klasse': 6,
        'sergeant': 7,
        'sergeant der 1e klasse': 8,
        'adjudant-onderofficier': 9,
        'kornet': 10,
        'tweede luitenant': 11,
        'eerste luitenant': 12,
        'kapitein': 13,
        'majoor': 14,
        'luitenant-kolonel': 15,
        'kolonel': 16,
        'brigade-generaal': 17,
        'generaal-majoor': 18,
        'luitenant-generaal': 19
    };
    
    // Converteer naar array en sorteer
    const rangArray = Array.from(rangSecties).sort((a, b) => {
        const rangA = a.dataset.rang;
        const rangB = b.dataset.rang;
        return (rangVolgorde[rangA] || 999) - (rangVolgorde[rangB] || 999);
    });
    
    // Verwijder alle en voeg in juiste volgorde terug toe
    rangArray.forEach(rang => categorie.appendChild(rang));
}

// Toon placeholders alleen voor rangen zonder personeel
function toonPlaceholdersVoorLegeRangen() {
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        const rang = lijst.dataset.rang;
        const rangDef = rangDefinities[rang];
        
        if (rangDef && lijst.children.length === 0) {
            // Genereer beperkte aantal placeholders (performance)
            const minNum = parseInt(rangDef.min.split('-')[1]);
            const maxNum = parseInt(rangDef.max.split('-')[1]);
            const prefix = rangDef.min.split('-')[0];
            
            // Toon maximaal 5 placeholders per rang
            const maxPlaceholders = Math.min(5, maxNum - minNum + 1);
            
            for (let i = 0; i < maxPlaceholders; i++) {
                const num = minNum + i;
                const roepnummer = prefix + '-' + num.toString().padStart(2, '0');
                
                // Check of dit roepnummer al in gebruik is
                const inGebruik = personeelData.some(p => p.roepnummer === roepnummer);
                
                if (!inGebruik) {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'personeel-rij placeholder';
                    placeholder.innerHTML = `
                        <div class="personeel-info">
                            <div class="personeel-avatar">?</div>
                            <div class="personeel-details">
                                <div class="personeel-naam">Beschikbaar</div>
                                <div class="personeel-discord">Geen toegewezen</div>
                            </div>
                        </div>
                        <div class="personeel-roepnummer">${roepnummer}</div>
                    `;
                    placeholder.style.cssText = `
                        opacity: 0.6;
                        border-style: dashed;
                    `;
                    lijst.appendChild(placeholder);
                }
            }
            
            // Voeg "meer beschikbaar" bericht toe als er meer zijn
            if (maxPlaceholders < (maxNum - minNum + 1)) {
                const meerBericht = document.createElement('div');
                meerBericht.className = 'personeel-rij meer-bericht';
                meerBericht.innerHTML = `
                    <div class="personeel-info">
                        <div class="personeel-avatar">⋯</div>
                        <div class="personeel-details">
                            <div class="personeel-naam">En ${maxNum - minNum + 1 - maxPlaceholders} meer beschikbaar</div>
                            <div class="personeel-discord">Alle roepnummers vrij</div>
                        </div>
                    </div>
                    <div class="personeel-roepnummer">${rangDef.min} - ${rangDef.max}</div>
                `;
                meerBericht.style.cssText = `
                    opacity: 0.7;
                    border-style: dashed;
                    background: rgba(74, 222, 128, 0.05);
                `;
                lijst.appendChild(meerBericht);
            }
        }
    });
}

// Maak personeel rij element
function createPersoneelRij(personeel) {
    const div = document.createElement('div');
    div.className = 'personeel-rij';
    div.draggable = true;
    div.dataset.personeelId = personeel.id;
    
    // Drag events
    div.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('personeelId', personeel.id);
        this.classList.add('dragging');
    });
    
    div.addEventListener('dragend', function() {
        this.classList.remove('dragging');
    });
    
    const avatarInitialen = personeel.naam.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    // Admin knoppen - tonen voor iedereen (demo mode)
    const adminKnoppen = `
        <div class="personeel-acties">
            <button class="btn-small btn-demotion" onclick="toonAdminMenu(event, '${personeel.id}', 'demote')" title="Demoteren">Demoteren</button>
            <button class="btn-small btn-promoveer" onclick="toonAdminMenu(event, '${personeel.id}', 'promote')" title="Promoveren">Promoveren</button>
            <button class="btn-small btn-ontsla" onclick="toonAdminMenu(event, '${personeel.id}', 'dismiss')" title="Ontslaan">Ontslaan</button>
        </div>
        
        <!-- Mini admin trigger -->
        <div class="admin-trigger" onclick="toggleMiniAdmin(event, '${personeel.id}')" title="Admin opties">⚙</div>
        
        <!-- Mini admin GUI -->
        <div class="mini-admin-gui" id="mini-admin-${personeel.id}">
            <button class="mini-admin-btn promote" onclick="promoveerPersoneel('${personeel.id}')" title="Promoveren">↑</button>
            <button class="mini-admin-btn demote" onclick="demoteerPersoneel('${personeel.id}')" title="Demoteren">↓</button>
            <button class="mini-admin-btn dismiss" onclick="ontslaPersoneel('${personeel.id}')" title="Ontslaan">×</button>
        </div>
    `;
    
    div.innerHTML = `
        <div class="personeel-info">
            <div class="personeel-avatar">${avatarInitialen}</div>
            <div class="personeel-details">
                <div class="personeel-naam">${personeel.naam}</div>
                <div class="personeel-discord">${personeel.discordId || personeel.discord || 'Geen Discord ID'}</div>
            </div>
        </div>
        <div class="personeel-roepnummer">${personeel.roepnummer || 'Nog niet toegewezen'}</div>
        ${adminKnoppen}
    `;
    
    // Voeg data-personeel-id toe voor zoekfunctie
    div.setAttribute('data-personeel-id', personeel.id);
    
    return div;
}

// Open modal voor nieuw personeel
function openNieuwePersoneelModal() {
    document.getElementById('nieuwePersoneelModal').style.display = 'block';
}

// Sluit modal
function sluitModal() {
    document.getElementById('nieuwePersoneelModal').style.display = 'none';
    document.getElementById('nieuweNaam').value = '';
    document.getElementById('nieuweDiscordId').value = '';
    document.getElementById('nieuweRang').value = '';
}

// Voeg nieuw personeel toe
async function voegPersoneelToe() {
    const naam = document.getElementById('nieuweNaam').value.trim();
    const discordId = document.getElementById('nieuweDiscordId').value.trim();
    const rang = document.getElementById('nieuweRang').value;
    
    if (!naam || !discordId || !rang) {
        alert('Vul alle velden in');
        return;
    }
    
    const nieuwPersoneel = {
        id: Date.now().toString(),
        naam: naam,
        discordId: discordId,
        rang: rang,
        roepnummer: null
    };
    
    // Wijs roepnummer toe
    const roepnummer = getVolgendeRoepnummer(rang);
    nieuwPersoneel.roepnummer = roepnummer;
    
    // Voeg lokaal toe (API werkt niet)
    personeelData.push(nieuwPersoneel);
    
    // Update alleen de specifieke rang sectie (performance)
    const rangSectie = document.querySelector(`.personeel-lijst[data-rang="${rang}"]`);
    if (rangSectie) {
        rangSectie.innerHTML = '';
        personeelData.filter(p => p.rang === rang).forEach(personeel => {
            rangSectie.appendChild(createPersoneelRij(personeel));
        });
    }
    
    sluitModal();
    showToast('Personeel succesvol toegevoegd');
    
    // Probeer te save naar API (maar faal niet als het niet werkt)
    try {
        await savePersoneel(nieuwPersoneel);
    } catch (error) {
        console.log('API save gefaald, data is lokaal opgeslagen:', error);
    }
}

// Promoveer personeel
async function promoveerPersoneel(personeelId, nieuweRang) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const oudeRang = personeel.rang;
    personeel.rang = nieuweRang;
    
    // Wijs nieuw roepnummer toe
    const roepnummer = getVolgendeRoepnummer(nieuweRang);
    personeel.roepnummer = roepnummer;
    
    // Update lokaal
    renderPersoneel();
    showToast(`${personeel.naam} gepromoveerd van ${oudeRang} naar ${nieuweRang}`);
    
    // Probeer te save naar API (maar faal niet als het niet werkt)
    try {
        await savePersoneel(personeel);
    } catch (error) {
        console.log('API save gefaald, data is lokaal bijgewerkt:', error);
    }
}

// Promoveer personeel via knop
async function promoveerPersoneelKnop(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const currentIndex = rangHiërarchie.indexOf(personeel.rang);
    if (currentIndex < rangHiërarchie.length - 1) {
        const nieuweRang = rangHiërarchie[currentIndex + 1];
        await promoveerPersoneel(personeelId, nieuweRang);
    } else {
        showToast(`${personeel.naam} heeft al de hoogste rang`);
    }
}

// Demoteer personeel
async function demoteerPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const currentIndex = rangHiërarchie.indexOf(personeel.rang);
    if (currentIndex > 0) {
        const nieuweRang = rangHiërarchie[currentIndex - 1];
        await promoveerPersoneel(personeelId, nieuweRang);
    } else {
        showToast(`${personeel.naam} heeft al de laagste rang`);
    }
}

// Toon admin menu context menu
function toonAdminMenu(event, personeelId, actie) {
    event.preventDefault();
    event.stopPropagation();
    
    // Verwijder bestaande menu
    const bestaandMenu = document.querySelector('.admin-context-menu');
    if (bestaandMenu) {
        bestaandMenu.remove();
    }
    
    // Maak nieuw menu
    const menu = document.createElement('div');
    menu.className = 'admin-context-menu';
    
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    // Genereer menu items op basis van actie
    let menuItems = '';
    
    if (actie === 'promote') {
        const volgendeRang = getVolgendeRang(personeel.rang);
        if (volgendeRang) {
            menuItems = `
                <div class="admin-context-menu-item promote" onclick="promoveerPersoneel('${personeelId}', '${volgendeRang}')">
                    <span>+</span> Promoveer naar ${volgendeRang}
                </div>
            `;
        } else {
            menuItems = `
                <div class="admin-context-menu-item promote" onclick="showToast('${personeel.naam} heeft al de hoogste rang')">
                    <span>!</span> Hoogste rang bereikt
                </div>
            `;
        }
    } else if (actie === 'demote') {
        const vorigeRang = getVorigeRang(personeel.rang);
        if (vorigeRang) {
            menuItems = `
                <div class="admin-context-menu-item demote" onclick="demoteerPersoneel('${personeelId}', '${vorigeRang}')">
                    <span>-</span> Demoteer naar ${vorigeRang}
                </div>
            `;
        } else {
            menuItems = `
                <div class="admin-context-menu-item demote" onclick="showToast('${personeel.naam} heeft al de laagste rang')">
                    <span>!</span> Laagste rang bereikt
                </div>
            `;
        }
    } else if (actie === 'dismiss') {
        menuItems = `
            <div class="admin-context-menu-item dismiss" onclick="ontslaPersoneel('${personeelId}')">
                <span>×</span> Ontsla ${personeel.naam}
            </div>
        `;
    }
    
    menu.innerHTML = menuItems;
    
    // Positioneer menu
    const rect = event.target.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + window.scrollY) + 'px';
    
    // Voeg toe aan body
    document.body.appendChild(menu);
    
    // Toon menu
    setTimeout(() => menu.classList.add('show'), 10);
    
    // Sluit menu bij click buiten
    setTimeout(() => {
        document.addEventListener('click', sluitAdminMenu);
    }, 100);
}

// Sluit admin menu
function sluitAdminMenu() {
    const menu = document.querySelector('.admin-context-menu');
    if (menu) {
        menu.remove();
        document.removeEventListener('click', sluitAdminMenu);
    }
}

// Toggle mini admin GUI
function toggleMiniAdmin(event, personeelId) {
    event.preventDefault();
    event.stopPropagation();
    
    // Sluit alle andere mini GUI's
    document.querySelectorAll('.mini-admin-gui').forEach(gui => {
        gui.classList.remove('show');
    });
    
    // Toggle deze GUI
    const gui = document.getElementById(`mini-admin-${personeelId}`);
    if (gui) {
        gui.classList.toggle('show');
    }
    
    // Sluit context menu als die open is
    sluitAdminMenu();
}

// Sluit alle mini GUI's
function sluitAlleMiniGUIs() {
    document.querySelectorAll('.mini-admin-gui').forEach(gui => {
        gui.classList.remove('show');
    });
}

// Get volgende rang
function getVolgendeRang(huidigeRang) {
    const index = rangHiërarchie.indexOf(huidigeRang);
    return index < rangHiërarchie.length - 1 ? rangHiërarchie[index + 1] : null;
}

// Get vorige rang
function getVorigeRang(huidigeRang) {
    const index = rangHiërarchie.indexOf(huidigeRang);
    return index > 0 ? rangHiërarchie[index - 1] : null;
}

// Ontsla personeel
async function ontslaPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    if (!confirm(`Weet je zeker dat je ${personeel.naam} wilt ontslaan?`)) {
        return;
    }
    
    // Verwijder lokaal
    personeelData = personeelData.filter(p => p.id !== personeelId);
    renderPersoneel();
    showToast(`${personeel.naam} is ontslagen`);
    
    // Probeer te delete van API (maar faal niet als het niet werkt)
    try {
        await deletePersoneel(personeelId);
    } catch (error) {
        console.log('API delete gefaald, data is lokaal verwijderd:', error);
    }
    
    sluitAdminMenu();
}

// Get volgende beschikbare roepnummer voor een rang
function getVolgendeRoepnummer(rang) {
    const rangDef = rangDefinities[rang];
    if (!rangDef) return null;
    
    const bestaandeNummers = personeelData
        .filter(p => p.rang === rang && p.roepnummer)
        .map(p => parseInt(p.roepnummer.split('-')[1]))
        .sort((a, b) => a - b);
    
    const minNum = parseInt(rangDef.min.split('-')[1]);
    const maxNum = parseInt(rangDef.max.split('-')[1]);
    
    for (let num = minNum; num <= maxNum; num++) {
        if (!bestaandeNummers.includes(num)) {
            return rangDef.min.split('-')[0] + '-' + num.toString().padStart(2, '0');
        }
    }
    
    return rangDef.min; // Fallback als alles bezet is
}

// Save personeel naar backend
async function savePersoneel(personeel) {
    const response = await fetch(`${API_URL}/api/roepnummer-bestand`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(personeel)
    });
    
    if (!response.ok) {
        throw new Error('Fout bij opslaan personeel');
    }
    
    return response.json();
}

// Delete personeel van backend
async function deletePersoneel(personeelId) {
    const response = await fetch(`${API_URL}/api/roepnummer-bestand/${personeelId}`, {
        method: 'DELETE'
    });
    
    if (!response.ok) {
        throw new Error('Fout bij verwijderen personeel');
    }
    
    return response.json();
}

// Toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4ade80;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        document.body.removeChild(toast);
    }, 3000);
}
