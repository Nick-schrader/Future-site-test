// Roepnummer pagina JavaScript
let personeelData = [];
let huidigeCategorie = 'manschappen';

// Rang categorieën
const rangCategorieën = {
    'manschappen': ['4e klasse', '3e klasse', '2e klasse', '1e klasse'],
    'korporaals': ['wachtmeester', 'wachtmeester 1e klasse', 'opperwachtmeester'],
    'onderofficieren': ['adjudant-onderofficier', 'kornet'],
    'officieren': ['tweede luitenant', 'eerste luitenant', 'kapitein'],
    'hoofdofficieren': ['majoor', 'luitenant-kolonel', 'kolonel'],
    'kader': ['brigade-generaal', 'generaal-majoor', 'luitenant-generaal']
};

// Helper functie om user data te krijgen
function getUser() {
    try {
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
    toonRoepnummerPagina();
    laadPersoneel();
    setupEventListeners();
});

// Toon de pagina
function toonRoepnummerPagina() {
    const container = document.querySelector('.roepnummer-container');
    const geenToegang = document.querySelector('.geen-toegang');
    
    if (container) container.style.display = 'block';
    if (geenToegang) geenToegang.style.display = 'none';
}

// Setup event listeners
function setupEventListeners() {
    // Admin knop
    const nieuwePersoneelBtn = document.getElementById('nieuwePersoneelBtn');
    if (nieuwePersoneelBtn) {
        nieuwePersoneelBtn.style.display = 'inline-block';
        nieuwePersoneelBtn.addEventListener('click', openNieuwePersoneelModal);
    }
    
    // Categorie selectie dropdown
    const categorieSelect = document.getElementById('categorieSelect');
    if (categorieSelect) {
        categorieSelect.value = 'manschappen';
        categorieSelect.addEventListener('change', function() {
            huidigeCategorie = this.value;
            filterCategorie();
        });
        setTimeout(() => filterCategorie(), 100);
    }
    
    // Zoekfunctie
    const zoekInput = document.getElementById('zoekInput');
    const zoekBtn = document.getElementById('zoekBtn');
    
    if (zoekInput && zoekBtn) {
        zoekInput.addEventListener('input', zoekPersoneel);
        zoekInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') zoekPersoneel();
        });
        zoekBtn.addEventListener('click', zoekPersoneel);
    }
    
    // Modal sluiten
    const nieuwePersoneelModal = document.getElementById('nieuwePersoneelModal');
    if (nieuwePersoneelModal) {
        nieuwePersoneelModal.addEventListener('click', function(e) {
            if (e.target === this) sluitModal();
        });
    }
    
    // Setup drag and drop
    setupDragAndDrop();
}

// Laad personeel data
async function laadPersoneel() {
    try {
        const response = await fetch('/api/roepnummer-bestand');
        
        if (response.ok) {
            const data = await response.json();
            personeelData = data.personeel || [];
            console.log('Personeelsdata van API geladen:', personeelData);
            renderPersoneel();
            localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        } else {
            const storedData = localStorage.getItem('roepnummerData');
            if (storedData) {
                personeelData = JSON.parse(storedData);
                console.log('Personeelsdata van localStorage geladen:', personeelData);
                renderPersoneel();
            } else {
                // Voeg test data toe om admin click te testen
                personeelData = [
                    {
                        id: '1',
                        naam: 'Test Personeel 1',
                        discordId: 'test123',
                        rang: '4e klasse',
                        roepnummer: '57-01'
                    },
                    {
                        id: '2',
                        naam: 'Test Personeel 2',
                        discordId: 'test456',
                        rang: '3e klasse',
                        roepnummer: '56-41'
                    }
                ];
                console.log('Test personeelsdata geladen:', personeelData);
                renderPersoneel();
            }
        }
    } catch (error) {
        console.error('Fout bij laden personeel:', error);
        // Voeg test data toe bij error
        personeelData = [
            {
                id: '1',
                naam: 'Test Personeel 1',
                discordId: 'test123',
                rang: '4e klasse',
                roepnummer: '57-01'
            },
            {
                id: '2',
                naam: 'Test Personeel 2',
                discordId: 'test456',
                rang: '3e klasse',
                roepnummer: '56-41'
            }
        ];
        renderPersoneel();
    }
}

// Render personeel
function renderPersoneel() {
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        lijst.innerHTML = '';
    });
    
    personeelData.forEach(personeel => {
        const rangSectie = document.querySelector(`.personeel-lijst[data-rang="${personeel.rang}"]`);
        if (rangSectie) {
            rangSectie.appendChild(createPersoneelRij(personeel));
        }
    });
    
    toonPlaceholdersVoorLegeRangen();
}

// Create personeel rij
function createPersoneelRij(personeel) {
    const div = document.createElement('div');
    div.className = 'personeel-rij';
    div.draggable = true;
    div.dataset.personeelId = personeel.id;
    
    const user = getUser();
    const isAdmin = user.role === 'Administratie' || user.role === 'admin' || user.role === 'beheer';
    
    const avatarInitialen = personeel.naam.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    const adminKnoppen = isAdmin ? `
        <div class="admin-trigger" onclick="toggleMiniAdmin(event, '${personeel.id}')" title="Admin opties">?</div>
        <div class="mini-admin-gui" id="mini-admin-${personeel.id}">
            <button class="mini-admin-btn promote" onclick="promoveerPersoneel('${personeel.id}')" title="Promoveren">?</button>
            <button class="mini-admin-btn demote" onclick="demoteerPersoneel('${personeel.id}')" title="Demoteren">?</button>
            <button class="mini-admin-btn dismiss" onclick="ontslaPersoneel('${personeel.id}')" title="Ontslaan">×</button>
        </div>
    ` : '';
    
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
    
    div.setAttribute('data-personeel-id', personeel.id);
    
    // Voeg click event toe aan de hele rij (behalve admin knoppen)
    div.addEventListener('click', function(e) {
        if (!e.target.closest('.admin-trigger') && !e.target.closest('.mini-admin-gui')) {
            if (isAdmin) {
                toggleMiniAdmin(e, personeel.id);
            }
        }
    });
    
    div.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('personeelId', personeel.id);
        this.classList.add('dragging');
    });
    
    div.addEventListener('dragend', function() {
        this.classList.remove('dragging');
    });
    
    return div;
}

// Toon placeholders voor lege rangen
function toonPlaceholdersVoorLegeRangen() {
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        const rang = lijst.dataset.rang;
        const personeelInRang = personeelData.filter(p => p.rang === rang);
        
        const bestaandePlaceholders = lijst.querySelectorAll('.personeel-placeholder');
        bestaandePlaceholders.forEach(p => p.remove());
        
        if (personeelInRang.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'personeel-placeholder';
            placeholder.innerHTML = `
                <div class="placeholder-avatar"></div>
                <div class="placeholder-info">
                    <div class="placeholder-naam">Geen mensen op deze rang</div>
                    <div class="placeholder-roepnummer"></div>
                </div>
            `;
            lijst.appendChild(placeholder);
        }
    });
}

// Filter categorieën
function filterCategorie() {
    const categorieContainer = document.querySelector('.rang-categorie-container');
    if (!categorieContainer) return;
    
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
    
    const zichtbareCategorieën = categorieContainer.querySelectorAll('.rang-categorie:not([style*="display: none"])');
    if (zichtbareCategorieën.length === 0) return;
    
    const eersteZichtbare = zichtbareCategorieën[0];
    eersteZichtbare.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Zoek personeel
function zoekPersoneel() {
    const zoekInput = document.getElementById('zoekInput');
    const zoekTerm = zoekInput.value.toLowerCase().trim();
    
    if (!zoekTerm) {
        document.querySelectorAll('.personeel-rij').forEach(rij => {
            rij.style.display = 'flex';
            resetHighlighting(rij);
        });
        return;
    }
    
    personeelData.forEach(personeel => {
        const rij = document.querySelector(`[data-personeel-id="${personeel.id}"]`);
        if (rij) {
            const naamMatch = personeel.naam.toLowerCase().includes(zoekTerm);
            const roepnummerMatch = personeel.roepnummer && personeel.roepnummer.toLowerCase().includes(zoekTerm);
            const discordMatch = personeel.discordId && personeel.discordId.toLowerCase().includes(zoekTerm);
            
            if (naamMatch || roepnummerMatch || discordMatch) {
                rij.style.display = 'flex';
                highlightZoekTerm(rij, zoekTerm);
            } else {
                rij.style.display = 'none';
                resetHighlighting(rij);
            }
        }
    });
}

// Highlight zoekterm
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

// Highlight tekst
function highlightTekst(tekst, zoekTerm) {
    const regex = new RegExp(`(${zoekTerm})`, 'gi');
    return tekst.replace(regex, '<mark style="background: #fbbf24; color: #1f2937; padding: 2px; border-radius: 2px;">$1</mark>');
}

// Reset highlighting
function resetHighlighting(element) {
    const naamElement = element.querySelector('.personeel-naam');
    const discordElement = element.querySelector('.personeel-discord');
    
    if (naamElement) {
        naamElement.innerHTML = naamElement.textContent;
    }
    
    if (discordElement) {
        discordElement.innerHTML = discordElement.textContent;
    }
}

// Toggle mini admin
function toggleMiniAdmin(event, personeelId) {
    event.stopPropagation();
    
    const miniAdmin = document.getElementById(`mini-admin-${personeelId}`);
    if (!miniAdmin) return;
    
    const alleMiniAdmins = document.querySelectorAll('.mini-admin-gui');
    
    alleMiniAdmins.forEach(gui => {
        if (gui !== miniAdmin) {
            gui.style.display = 'none';
        }
    });
    
    miniAdmin.style.display = miniAdmin.style.display === 'block' ? 'none' : 'block';
}

// Promoveer personeel
function promoveerPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const currentIndex = rangHiërarchie.indexOf(personeel.rang);
    if (currentIndex < rangHiërarchie.length - 1) {
        const nieuweRang = rangHiërarchie[currentIndex + 1];
        personeel.rang = nieuweRang;
        
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        toonNotificatie(`${personeel.naam} is gepromoveerd naar ${nieuweRang}`);
    }
}

// Demoteer personeel
function demoteerPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const currentIndex = rangHiërarchie.indexOf(personeel.rang);
    if (currentIndex > 0) {
        const nieuweRang = rangHiërarchie[currentIndex - 1];
        personeel.rang = nieuweRang;
        
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        toonNotificatie(`${personeel.naam} is gedemoteerd naar ${nieuweRang}`);
    }
}

// Ontsla personeel
function ontslaPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    if (confirm(`Weet je zeker dat je ${personeel.naam} wilt ontslaan?`)) {
        personeelData = personeelData.filter(p => p.id !== personeelId);
        
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        toonNotificatie(`${personeel.naam} is ontslagen`);
    }
}

// Open modal
function openNieuwePersoneelModal() {
    const modal = document.getElementById('nieuwePersoneelModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Sluit modal
function sluitModal() {
    const modal = document.getElementById('nieuwePersoneelModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear form
        document.getElementById('nieuweNaam').value = '';
        document.getElementById('nieuweDiscordId').value = '';
        document.getElementById('nieuweRang').value = '';
        document.getElementById('nieuweRoepnummer').value = '';
    }
}

// Voeg nieuw personeel toe
async function voegPersoneelToe() {
    const naam = document.getElementById('nieuweNaam').value.trim();
    const discordId = document.getElementById('nieuweDiscordId').value.trim();
    const rang = document.getElementById('nieuweRang').value;
    const roepnummerInput = document.getElementById('nieuweRoepnummer')?.value.trim();
    
    if (!naam || !discordId || !rang) {
        alert('Vul alle velden in');
        return;
    }
    
    const nieuwPersoneel = {
        id: Date.now().toString(),
        naam: naam,
        discordId: discordId,
        rang: rang,
        roepnummer: roepnummerInput || null
    };
    
    if (!roepnummerInput) {
        const roepnummer = getVolgendeRoepnummer(rang);
        nieuwPersoneel.roepnummer = roepnummer;
    }
    
    personeelData.push(nieuwPersoneel);
    
    const rangSectie = document.querySelector(`.personeel-lijst[data-rang="${rang}"]`);
    if (rangSectie) {
        rangSectie.innerHTML = '';
        personeelData.filter(p => p.rang === rang).forEach(personeel => {
            rangSectie.appendChild(createPersoneelRij(personeel));
        });
    }
    
    localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
    
    sluitModal();
    toonNotificatie('Personeel succesvol toegevoegd');
}

// Get volgende roepnummer
function getVolgendeRoepnummer(rang) {
    const rangDefinities = {
        '4e klasse': { min: '57-01', max: '57-99' },
        '3e klasse': { min: '56-41', max: '56-99' },
        '2e klasse': { min: '56-21', max: '56-40' },
        '1e klasse': { min: '56-01', max: '56-20' },
        'wachtmeester': { min: '55-41', max: '55-60' },
        'wachtmeester 1e klasse': { min: '55-25', max: '55-40' },
        'opperwachtmeester': { min: '55-01', max: '55-24' },
        'adjudant-onderofficier': { min: '54-09', max: '54-23' },
        'kornet': { min: '54-01', max: '54-08' },
        'tweede luitenant': { min: '53-06', max: '53-12' },
        'eerste luitenant': { min: '53-04', max: '53-05' },
        'kapitein': { min: '53-01', max: '53-03' },
        'majoor': { min: '52-07', max: '52-09' },
        'luitenant-kolonel': { min: '52-04', max: '52-06' },
        'kolonel': { min: '52-01', max: '52-03' },
        'brigade-generaal': { min: '51-04', max: '51-06' },
        'generaal-majoor': { min: '51-02', max: '51-03' },
        'luitenant-generaal': { min: '51-01', max: '51-01' }
    };
    
    const rangDef = rangDefinities[rang];
    if (!rangDef) return 'N/A';
    
    const [minPrefix, minNum] = rangDef.min.split('-');
    const [maxPrefix, maxNum] = rangDef.max.split('-');
    
    for (let i = parseInt(minNum); i <= parseInt(maxNum); i++) {
        const roepnummer = `${minPrefix}-${String(i).padStart(2, '0')}`;
        const inGebruik = personeelData.some(p => p.roepnummer === roepnummer);
        
        if (!inGebruik) {
            return roepnummer;
        }
    }
    
    return 'Geen beschikbaar';
}

// Toon notificatie
function toonNotificatie(bericht) {
    const notificatie = document.createElement('div');
    notificatie.className = 'notificatie';
    notificatie.textContent = bericht;
    notificatie.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4ade80;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notificatie);
    
    setTimeout(() => {
        notificatie.remove();
    }, 3000);
}

// Setup drag and drop
function setupDragAndDrop() {
    // Voeg drop event listeners toe aan alle personeel lijsten
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        lijst.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });
        
        lijst.addEventListener('dragleave', function(e) {
            if (e.target === this) {
                this.classList.remove('drag-over');
            }
        });
        
        lijst.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            
            const personeelId = e.dataTransfer.getData('personeelId');
            const nieuweRang = this.dataset.rang;
            
            if (personeelId && nieuweRang) {
                verplaatsPersoneelNaarRang(personeelId, nieuweRang);
            }
        });
    });
}

// Verplaats personeel naar nieuwe rang
function verplaatsPersoneelNaarRang(personeelId, nieuweRang) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const oudeRang = personeel.rang;
    personeel.rang = nieuweRang;
    
    // Wijs nieuw roepnummer toe indien nodig
    if (!personeel.roepnummer) {
        const roepnummer = getVolgendeRoepnummer(nieuweRang);
        personeel.roepnummer = roepnummer;
    }
    
    // Sla data op
    localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
    
    // Re-render
    renderPersoneel();
    
    // Toon notificatie
    toonNotificatie(`${personeel.naam} is verplaatst van ${oudeRang} naar ${nieuweRang}`);
}

// Rang hiërarchie
const rangHiërarchie = [
    '4e klasse', '3e klasse', '2e klasse', '1e klasse',
    'wachtmeester', 'wachtmeester 1e klasse', 'opperwachtmeester',
    'adjudant-onderofficier', 'kornet',
    'tweede luitenant', 'eerste luitenant', 'kapitein',
    'majoor', 'luitenant-kolonel', 'kolonel',
    'brigade-generaal', 'generaal-majoor', 'luitenant-generaal'
];
