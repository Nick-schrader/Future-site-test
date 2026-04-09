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
    updateActiveNavigation();
});

// Update actieve navigatie
function updateActiveNavigation() {
    // Verwijder active class van alle sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Voeg active class toe aan huidige pagina
    const currentPage = window.location.pathname.split('/').pop();
    const navItem = document.querySelector(`[href="${currentPage}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
}

// Toon de pagina
function toonRoepnummerPagina() {
    const container = document.querySelector('.roepnummer-container');
    const geenToegang = document.querySelector('.geen-toegang');
    
    if (container) container.style.display = 'block';
    if (geenToegang) geenToegang.style.display = 'none';
}

// Setup event listeners
function setupEventListeners() {
    // Admin knop - alleen zichtbaar voor Administratie rol
    const nieuwePersoneelBtn = document.getElementById('nieuwePersoneelBtn');
    if (nieuwePersoneelBtn) {
        const user = getUser();
        const isAdmin = user.rollen && user.rollen.some(rol => rol.naam === 'Administratie');
        
        if (isAdmin) {
            nieuwePersoneelBtn.style.display = 'inline-block';
            nieuwePersoneelBtn.addEventListener('click', openNieuwePersoneelModal);
        } else {
            nieuwePersoneelBtn.style.display = 'none';
        }
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
        const response = await fetch('/api/roepnummer/bestand');
        
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
                personeelData.forEach(p => {
                    console.log(`Personeel ${p.naam} - Discord ID: ${p.discordId}`);
                });
                renderPersoneel();
            } else {
                // Voeg test data toe om admin click te testen
                personeelData = [
                    {
                        id: '1',
                        naam: 'Test Personeel 1',
                        discordId: '1196035736823156790', // Gebruiker's Discord ID
                        rang: '4e klasse',
                        roepnummer: '57-01'
                    },
                    {
                        id: '2',
                        naam: 'Test Personeel 2',
                        discordId: '1196035736823156790', // Gebruiker's Discord ID
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
                discordId: '1196035736823156790', // Gebruiker's Discord ID
                rang: '4e klasse',
                roepnummer: '57-01'
            },
            {
                id: '2',
                naam: 'Test Personeel 2',
                discordId: '1196035736823156790', // Gebruiker's Discord ID
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
    
    // Sorteer personeel per rang op roepnummer
    const personeelPerRang = {};
    personeelData.forEach(personeel => {
        if (!personeelPerRang[personeel.rang]) {
            personeelPerRang[personeel.rang] = [];
        }
        personeelPerRang[personeel.rang].push(personeel);
    });
    
    // Sorteer elke rang op roepnummer
    Object.keys(personeelPerRang).forEach(rang => {
        personeelPerRang[rang].sort((a, b) => {
            // Als geen roepnummer, plaats aan het einde
            if (!a.roepnummer && !b.roepnummer) return 0;
            if (!a.roepnummer) return 1;
            if (!b.roepnummer) return -1;
            
            // Vergelijk roepnummers numeriek
            const numA = parseInt(a.roepnummer.replace(/[^0-9]/g, ''));
            const numB = parseInt(b.roepnummer.replace(/[^0-9]/g, ''));
            return numA - numB;
        });
        
        // Voeg gesorteerd personeel toe aan de lijst
        personeelPerRang[rang].forEach(personeel => {
            const rangSectie = document.querySelector(`.personeel-lijst[data-rang="${personeel.rang}"]`);
            if (rangSectie) {
                rangSectie.appendChild(createPersoneelRij(personeel));
            }
        });
    });
    
    toonPlaceholdersVoorLegeRangen();
}

// Create personeel rij
function createPersoneelRij(personeel) {
    const div = document.createElement('div');
    div.className = 'personeel-rij';
    
    // Check of gebruiker Administratie rol heeft voor admin functionaliteit
    const user = getUser();
    const isAdmin = user.rollen && user.rollen.some(rol => rol.naam === 'Administratie');
    
    // Drag and drop alleen voor admin
    div.draggable = isAdmin;
    
    div.dataset.personeelId = personeel.id;
    
    const avatarInitialen = personeel.naam.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    const adminKnoppen = isAdmin ? `
        <div class="admin-trigger" onclick="toggleMiniAdmin(event, '${personeel.id}')" title="Admin opties">?</div>
        <div class="mini-admin-gui" id="mini-admin-${personeel.id}">
            <button class="mini-admin-btn promote" onclick="promoveerPersoneel('${personeel.id}')" title="Promoveren">+</button>
            <button class="mini-admin-btn demote" onclick="demoteerPersoneel('${personeel.id}')" title="Demoteren">-</button>
            <button class="mini-admin-btn edit" onclick="bewerkRoepnummer('${personeel.id}')" title="Roepnummer bewerken">#</button>
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
        console.log('Click detected on personeel:', personeel.naam, 'Target:', e.target);
        
        // Check of de gebruiker een beheerder is via Discord rollen
        const user = getUser();
        console.log('User rollen:', user.rollen);
        const isAdmin = user.rollen && (
            user.rollen.some(rol => rol.naam === 'Administratie') || 
            user.rollen.some(rol => rol.naam === 'admin') || 
            user.rollen.some(rol => rol.naam === 'beheer') ||
            user.rollen.some(rol => rol.naam === 'Beheer') ||
            user.rollen.some(rol => rol.naam === 'Commandant') ||
            user.rollen.some(rol => rol.naam === 'Hoofdcommissaris')
        );
        console.log('Is admin:', isAdmin);
        
        // Check of we niet op admin knoppen klikken
        const isAdminTrigger = e.target.closest('.admin-trigger');
        const isMiniAdminGui = e.target.closest('.mini-admin-gui');
        console.log('Is admin trigger:', isAdminTrigger, 'Is mini admin GUI:', isMiniAdminGui);
        
        if (isAdmin && !isAdminTrigger && !isMiniAdminGui) {
            console.log('Calling toggleMiniAdmin for:', personeel.id);
            toggleMiniAdmin(e, personeel.id);
        } else {
            console.log('Not calling toggleMiniAdmin - conditions not met');
        }
    });
    
    // Drag and drop - alleen voor Administratie rol
    div.addEventListener('dragstart', function(e) {
        const user = getUser();
        const isAdmin = user.rollen && user.rollen.some(rol => rol.naam === 'Administratie');
        
        if (isAdmin) {
            e.dataTransfer.setData('personeelId', personeel.id);
            this.classList.add('dragging');
        } else {
            e.preventDefault();
        }
    });
    
    div.addEventListener('dragend', function() {
        const user = getUser();
        const isAdmin = user.rollen && user.rollen.some(rol => rol.naam === 'Administratie');
        
        if (isAdmin) {
            this.classList.remove('dragging');
        }
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

// Toggle mini admin GUI
function toggleMiniAdmin(event, personeelId) {
    console.log('toggleMiniAdmin called for:', personeelId);
    event.stopPropagation();

    const miniAdmin = document.getElementById(`mini-admin-${personeelId}`);
    console.log('Mini admin element found:', !!miniAdmin);
    if (!miniAdmin) {
        console.log('Mini admin element not found for ID:', personeelId);
        return;
    }

    const alleMiniAdmins = document.querySelectorAll('.mini-admin-gui');
    console.log('Found mini admin GUIs:', alleMiniAdmins.length);

    alleMiniAdmins.forEach(gui => {
        if (gui !== miniAdmin) {
            gui.style.display = 'none';
        }
    });

    const currentDisplay = miniAdmin.style.display;
    const newDisplay = currentDisplay === 'block' ? 'none' : 'block';
    miniAdmin.style.display = newDisplay;
    console.log('Mini admin display changed from:', currentDisplay, 'to:', newDisplay);
}

// Promoveer personeel
async function promoveerPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const currentIndex = rangHiërarchie.indexOf(personeel.rang);
    if (currentIndex < rangHiërarchie.length - 1) {
        const nieuweRang = rangHiërarchie[currentIndex + 1];
        const oudeRang = personeel.rang;
        personeel.rang = nieuweRang;
        
        // Wijs automatisch nieuw roepnummer toe voor de nieuwe rang
        const nieuwRoepnummer = getVolgendeRoepnummer(nieuweRang);
        if (nieuwRoepnummer) {
            personeel.roepnummer = nieuwRoepnummer;
        }
        
        // Save to API first
        try {
            const response = await fetch(`/api/roepnummer/personeel/${personeel.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rang: nieuweRang,
                    roepnummer: personeel.roepnummer,
                    naam: personeel.naam,
                    discordId: personeel.discordId
                })
            });
            
            if (response.ok) {
                console.log('[ROEPNUMMER] Promotie succesvol opgeslagen in database');
            } else {
                console.error('[ROEPNUMMER] Fout bij opslaan promotie:', response.statusText);
            }
        } catch (error) {
            console.error('[ROEPNUMMER] API fout bij promotie:', error);
        }
        
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        // Stuur bericht naar gebruiker over promotie
        if (personeel.discordId && typeof BerichtenSysteem !== 'undefined') {
            const berichtTekst = `Gefeliciteerd! Je bent gepromoveerd van ${oudeRang} naar ${nieuweRang} met nieuw roepnummer ${personeel.roepnummer}.`;
            BerichtenSysteem.stuurBericht(personeel.discordId, 'promotie', berichtTekst);
        }
        
        toonNotificatie(`${personeel.naam} is gepromoveerd naar ${nieuweRang} met roepnummer ${personeel.roepnummer}`);
    }
}

// Demoteer personeel
async function demoteerPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const currentIndex = rangHiërarchie.indexOf(personeel.rang);
    if (currentIndex > 0) {
        const nieuweRang = rangHiërarchie[currentIndex - 1];
        const oudeRang = personeel.rang;
        personeel.rang = nieuweRang;
        
        // Wijs automatisch nieuw roepnummer toe voor de nieuwe rang
        const nieuwRoepnummer = getVolgendeRoepnummer(nieuweRang);
        if (nieuwRoepnummer) {
            personeel.roepnummer = nieuwRoepnummer;
        }
        
        // Save to API first
        try {
            const response = await fetch(`/api/roepnummer/personeel/${personeel.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rang: nieuweRang,
                    roepnummer: personeel.roepnummer,
                    naam: personeel.naam,
                    discordId: personeel.discordId
                })
            });
            
            if (response.ok) {
                console.log('[ROEPNUMMER] Demotie succesvol opgeslagen in database');
            } else {
                console.error('[ROEPNUMMER] Fout bij opslaan demotie:', response.statusText);
            }
        } catch (error) {
            console.error('[ROEPNUMMER] API fout bij demotie:', error);
        }
        
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        // Stuur bericht naar gebruiker over demotie
        if (personeel.discordId && typeof BerichtenSysteem !== 'undefined') {
            const berichtTekst = `Je bent gedemoteerd van ${oudeRang} naar ${nieuweRang} met nieuw roepnummer ${personeel.roepnummer}.`;
            BerichtenSysteem.stuurBericht(personeel.discordId, 'demotie', berichtTekst);
        }
        
        toonNotificatie(`${personeel.naam} is gedemoteerd naar ${nieuweRang} met roepnummer ${personeel.roepnummer}`);
    }
}

// Ontsla personeel
async function ontslaPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    if (confirm(`Weet je zeker dat je ${personeel.naam} wilt ontslaan?`)) {
        // Delete from API first
        try {
            const response = await fetch(`/api/roepnummer/personeel/${personeelId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                console.log('[ROEPNUMMER] Personeel succesvol verwijderd uit database');
            } else {
                console.error('[ROEPNUMMER] Fout bij verwijderen personeel:', response.statusText);
                // Continue with localStorage as fallback
            }
        } catch (error) {
            console.error('[ROEPNUMMER] API fout bij ontslaan personeel:', error);
            // Continue with localStorage as fallback
        }
        
        personeelData = personeelData.filter(p => p.id !== personeelId);
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        // Stuur bericht naar gebruiker over ontslag
        if (personeel.discordId && typeof BerichtenSysteem !== 'undefined') {
            const berichtTekst = `Je bent ontslagen uit de dienst. Bedankt voor je inzet.`;
            BerichtenSysteem.stuurBericht(personeel.discordId, 'ontslag', berichtTekst);
        }
        
        toonNotificatie(`${personeel.naam} is ontslagen`);
    }
}

// Bewerk roepnummer
function bewerkRoepnummer(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    // Maak een mooie modal voor roepnummer bewerken
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card">
            <h2>Roepnummer Bewerken</h2>
            <div class="form-group">
                <label>Naam:</label>
                <input type="text" class="input-field" value="${personeel.naam}" readonly>
            </div>
            <div class="form-group">
                <label>Huidig Roepnummer:</label>
                <input type="text" class="input-field" value="${personeel.roepnummer || ''}" readonly>
            </div>
            <div class="form-group">
                <label>Nieuw Roepnummer:</label>
                <input type="text" id="nieuwRoepnummerInput" class="input-field" placeholder="Voer nieuw roepnummer in..." value="${personeel.roepnummer || ''}">
            </div>
            <div class="modal-buttons">
                <button class="btn-purple" onclick="slaRoepnummerOp('${personeelId}', this)">Opslaan</button>
                <button class="btn-ghost" onclick="sluitRoepnummerModal(this)">Annuleren</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Focus op input field
    setTimeout(() => {
        const input = document.getElementById('nieuwRoepnummerInput');
        if (input) {
            input.focus();
            input.select();
        }
    }, 100);
}

// Sla roepnummer op
async function slaRoepnummerOp(personeelId, buttonElement) {
    const input = document.getElementById('nieuwRoepnummerInput');
    if (!input) return;
    
    const nieuwRoepnummer = input.value.trim();
    if (nieuwRoepnummer === '') {
        toonNotificatie('Roepnummer mag niet leeg zijn');
        return;
    }
    
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    // Save to API first
    try {
        const response = await fetch(`/api/roepnummer/personeel/${personeelId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rang: personeel.rang,
                roepnummer: nieuwRoepnummer,
                naam: personeel.naam,
                discordId: personeel.discordId
            })
        });
        
        if (response.ok) {
            console.log('[ROEPNUMMER] Roepnummer succesvol opgeslagen in database');
        } else {
            console.error('[ROEPNUMMER] Fout bij opslaan roepnummer:', response.statusText);
            // Continue with localStorage as fallback
        }
    } catch (error) {
        console.error('[ROEPNUMMER] API fout bij opslaan roepnummer:', error);
        // Continue with localStorage as fallback
    }
    
    personeel.roepnummer = nieuwRoepnummer;
    localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
    renderPersoneel();
    
    // Stuur bericht naar gebruiker over roepnummer wijziging
    if (personeel.discordId && typeof BerichtenSysteem !== 'undefined') {
        const berichtTekst = `Je roepnummer is gewijzigd naar ${personeel.roepnummer}.`;
        BerichtenSysteem.stuurBericht(personeel.discordId, 'roepnummer', berichtTekst);
    }
    
    toonNotificatie(`Roepnummer van ${personeel.naam} is gewijzigd naar ${personeel.roepnummer}`);
    
    sluitRoepnummerModal(buttonElement);
}

// Sluit roepnummer modal
function sluitRoepnummerModal(buttonElement) {
    const modal = buttonElement.closest('.modal-overlay');
    if (modal) {
        modal.remove();
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
    
    // Save to API first
    try {
        const response = await fetch('/api/roepnummer/personeel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                naam: naam,
                discordId: discordId,
                rang: rang,
                roepnummer: nieuwPersoneel.roepnummer
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            nieuwPersoneel.id = result.id.toString(); // Use database ID
            console.log('[ROEPNUMMER] Personeel succesvol opgeslagen in database');
        } else {
            console.error('[ROEPNUMMER] Fout bij opslaan personeel:', response.statusText);
            // Continue with localStorage as fallback
        }
    } catch (error) {
        console.error('[ROEPNUMMER] API fout bij toevoegen personeel:', error);
        // Continue with localStorage as fallback
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
        '4e klasse': { min: '56-81', max: '56-140' },
        '3e klasse': { min: '56-41', max: '56-80' },
        '2e klasse': { min: '56-21', max: '56-40' },
        '1e klasse': { min: '56-01', max: '56-20' },
        'wachtmeester': { min: '55-41', max: '55-60' },
        'wachtmeester 1e klasse': { min: '55-25', max: '55-48' },
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
    
    // Wijs ALTIJD nieuw roepnummer toe bij rang verandering
    const roepnummer = getVolgendeRoepnummer(nieuweRang);
    personeel.roepnummer = roepnummer;
    
    // Sla data op
    localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
    
    // Re-render
    renderPersoneel();
    
    // Toon notificatie
    toonNotificatie(`${personeel.naam} is verplaatst van ${oudeRang} naar ${nieuweRang} met roepnummer ${roepnummer}`);
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
