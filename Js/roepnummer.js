// Roepnummer pagina JavaScript
const API = window.location.origin;
let personeelData = [];
let huidigeCategorie = 'manschappen';

// Rang categorieën
const rangCategorieën = {
    'manschappen': ['1e klasse', '2e klasse', '3e klasse', '4e klasse'],
    'korporaals': ['opperwachtmeester', 'wachtmeester 1e klasse', 'wachtmeester'],
    'onderofficieren': ['kornet', 'adjudant-onderofficier'],
    'officieren': ['kapitein', 'eerste luitenant', 'tweede luitenant'],
    'hoofdofficieren': ['kolonel', 'luitenant-kolonel', 'majoor'],
    'kader': ['luitenant-generaal', 'generaal-majoor', 'brigade-generaal']
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

// Logging functie voor personeel acties
function logPersoneelActie(actie, doelwit, details) {
    const user = getUser();
    const logData = {
        actie: actie,
        door: user.displayName || user.username || 'Onbekend',
        doelwit: doelwit,
        details: details,
        tijd: new Date().toISOString()
    };
    
    console.log('[LOG] Personeel actie:', logData);
    
    // Stuur log naar backend
    fetch(`${API_URL}/api/logs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(logData)
    }).catch(err => {
        console.error('[LOG] Fout bij loggen:', err);
    });
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
    // Admin knoppen - alleen zichtbaar voor Administratie rol
    const nieuwePersoneelBtn = document.getElementById('nieuwePersoneelBtn');
    const blacklistBtn = document.getElementById('blacklistBtn');
    const resetDatabaseBtn = document.getElementById('resetDatabaseBtn');
    
    if (nieuwePersoneelBtn || blacklistBtn || resetDatabaseBtn) {
        const user = getUser();
        const isAdmin = user.rollen && user.rollen.some(rol => rol.naam === 'Administratie' || rol.naam === 'Kader');
        
        if (isAdmin) {
            if (nieuwePersoneelBtn) {
                nieuwePersoneelBtn.style.display = 'inline-block';
                nieuwePersoneelBtn.addEventListener('click', openNieuwePersoneelModal);
            }
            if (blacklistBtn) {
                blacklistBtn.style.display = 'inline-block';
            }
            if (resetDatabaseBtn) {
                resetDatabaseBtn.style.display = 'inline-block';
                resetDatabaseBtn.addEventListener('click', resetDatabase);
            }
        } else {
            if (nieuwePersoneelBtn) nieuwePersoneelBtn.style.display = 'none';
            if (blacklistBtn) blacklistBtn.style.display = 'none';
            if (resetDatabaseBtn) resetDatabaseBtn.style.display = 'none';
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
            
            // Map database fields to frontend structure
            personeelData = personeelData.map(p => ({
                id: p.id.toString(),
                naam: p.naam,
                discordId: p.discord_id || p.discordId || 'unknown', // Map discord_id to discordId with fallback
                rang: p.rang,
                roepnummer: p.roepnummer
            }));
            
            console.log('Gemappeerde personeelsdata:', personeelData);
            personeelData.forEach(p => {
                console.log(`Personeel ${p.naam} - ID: ${p.id} - Discord ID: ${p.discordId} - Rang: ${p.rang}`);
            });
            
            renderPersoneel();
            // Sync localStorage with database data (for UI state only)
            localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        } else {
            console.error('[ROEPNUMMER] CRITICAL: Database not available for personeel data');
            showToast('Database niet beschikbaar - kan geen personeelsdata laden', 'error');
            personeelData = [];
            renderPersoneel();
        }
    } catch (error) {
        console.error('[ROEPNUMMER] CRITICAL: Database connection failed:', error);
        showToast('Database niet bereikbaar - kan geen personeelsdata laden', 'error');
        personeelData = [];
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
    const isAdmin = user.rollen && user.rollen.some(rol => rol.naam === 'Administratie' || rol.naam === 'Kader');
    
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
            <button class="mini-admin-btn blacklist" onclick="blacklistPersoneel('${personeel.id}')" title="Blacklisten">🚫</button>
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
            user.rollen.some(rol => rol.naam === 'Kader') ||
            user.rollen.some(rol => rol.naam === 'Beheer') ||
            user.rollen.some(rol => rol.naam === 'Commandant') ||
            user.rollen.some(rol => rol.naam === 'Hoofdcommissaris')
        );
        console.log('Is admin:', isAdmin);
        
        // Check of we niet op admin knoppen of mini admin GUI klikken
        const isAdminTrigger = e.target.closest('.admin-trigger');
        const isMiniAdminButton = e.target.closest('.mini-admin-btn');
        const isMiniAdminGui = e.target.closest('.mini-admin-gui');
        console.log('Is admin trigger:', isAdminTrigger, 'Is mini admin button:', isMiniAdminButton, 'Is mini admin GUI:', isMiniAdminGui);
        
        // Alleen toggleMiniAdmin als we op de personeel rij klikken, niet op knoppen
        if (isAdmin && !isAdminTrigger && !isMiniAdminButton && !isMiniAdminGui) {
            console.log('Calling toggleMiniAdmin for:', personeel.id);
            toggleMiniAdmin(e, personeel.id);
        } else {
            console.log('Not calling toggleMiniAdmin - conditions not met');
        }
    });
    
    // Drag and drop - alleen voor Administratie rol
    div.addEventListener('dragstart', function(e) {
        const user = getUser();
        const isAdmin = user.rollen && user.rollen.some(rol => rol.naam === 'Administratie' || rol.naam === 'Kader');
        
        if (isAdmin) {
            e.dataTransfer.setData('personeelId', personeel.id);
            this.classList.add('dragging');
        } else {
            e.preventDefault();
        }
    });
    
    div.addEventListener('dragend', function() {
        const user = getUser();
        const isAdmin = user.rollen && user.rollen.some(rol => rol.naam === 'Administratie' || rol.naam === 'Kader');
        
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
        showToast('Fout bij promotie - database niet bereikbaar', 'error');
        }
        
        // Sync localStorage with database data (for UI state only)
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        // Stuur bericht naar gebruiker over promotie
        if (personeel.discordId) {
            const berichtTekst = `Gefeliciteerd! Je bent gepromoveerd van ${oudeRang} naar ${nieuweRang} met nieuw roepnummer ${personeel.roepnummer}.`;
            console.log('[PROMOVEER] Bericht sturen naar:', personeel.discordId, 'Tekst:', berichtTekst);
            
            // Wacht op BerichtenSysteem als het nog niet beschikbaar is
            const stuurBerichtMetRetry = () => {
                if (typeof BerichtenSysteem !== 'undefined') {
                    console.log('[PROMOVEER] BerichtenSysteem beschikbaar, bericht versturen');
                    BerichtenSysteem.stuurBericht(personeel.discordId, 'promotie', berichtTekst);
                    console.log('[PROMOVEER] Bericht verzonden');
                } else {
                    console.log('[PROMOVEER] BerichtenSysteem nog niet beschikbaar, retry in 100ms...');
                    setTimeout(stuurBerichtMetRetry, 100);
                }
            };
            
            stuurBerichtMetRetry();
        } else {
            console.log('[PROMOVEER] Geen discordId, geen bericht gestuurd');
        }
        
        toonNotificatie(`${personeel.naam} is gepromoveerd naar ${nieuweRang} met roepnummer ${personeel.roepnummer}`);
        
        // Log de promotie actie
        logPersoneelActie('promotie', personeel.naam, `${oudeRang} -> ${nieuweRang} | Roepnummer: ${personeel.roepnummer}`);
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
        showToast('Fout bij demotie - database niet bereikbaar', 'error');
        }
        
        // Sync localStorage with database data (for UI state only)
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        // Stuur bericht naar gebruiker over demotie
        if (personeel.discordId) {
            const berichtTekst = `Je bent gedemoteerd van ${oudeRang} naar ${nieuweRang} met nieuw roepnummer ${personeel.roepnummer}.`;
            
            // Wacht op BerichtenSysteem als het nog niet beschikbaar is
            const stuurBerichtMetRetry = () => {
                if (typeof BerichtenSysteem !== 'undefined') {
                    BerichtenSysteem.stuurBericht(personeel.discordId, 'demotie', berichtTekst);
                } else {
                    setTimeout(stuurBerichtMetRetry, 100);
                }
            };
            
            stuurBerichtMetRetry();
        }
        
        toonNotificatie(`${personeel.naam} is gedemoteerd naar ${nieuweRang} met roepnummer ${personeel.roepnummer}`);
        
        // Log de demotie actie
        logPersoneelActie('demotie', personeel.naam, `${oudeRang} -> ${nieuweRang} | Roepnummer: ${personeel.roepnummer}`);
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
        // Sync localStorage with database data (for UI state only)
        localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
        renderPersoneel();
        
        // Reset login status for dismissed user
        try {
            const dismissResponse = await fetch(`/api/dismiss-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    discordId: personeel.discordId,
                    reden: 'Ontslagen uit dienst'
                })
            });
            
            if (dismissResponse.ok) {
                console.log('[ROEPNUMMER] Login status gereset voor ontslagen gebruiker');
            } else {
                console.error('[ROEPNUMMER] Fout bij resetten login status:', dismissResponse.statusText);
            }
        } catch (error) {
            console.error('[ROEPNUMMER] API fout bij resetten login status:', error);
        }
        
        // Stuur bericht naar gebruiker over ontslag
        if (personeel.discordId && typeof BerichtenSysteem !== 'undefined') {
            const berichtTekst = `Je bent ontslagen uit de dienst. Bedankt voor je inzet. Je toegang tot het systeem is ingetrokken.`;
            BerichtenSysteem.stuurBericht(personeel.discordId, 'ontslag', berichtTekst);
        }
        
        toonNotificatie(`${personeel.naam} is ontslagen en toegang is ingetrokken`);
        
        // Log de ontslag actie
        const doelwitInfo = personeel.discordId ? `${personeel.naam} (${personeel.discordId})` : personeel.naam;
        logPersoneelActie('ontslag', doelwitInfo, `Ontslagen uit dienst | Laatste rang: ${personeel.rang}${personeel.roepnummer ? ` | Roepnummer: ${personeel.roepnummer}` : ''} | Toegang ingetrokken`);
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
    
    const oudRoepnummer = personeel.roepnummer;
    const oudeRang = personeel.rang;
    
    // Bepaal automatisch de juiste rang op basis van het nieuwe roepnummer
    const nieuweRang = getRangVoorRoepnummer(nieuwRoepnummer);
    
    // Update de rang als deze anders is
    if (nieuweRang !== personeel.rang) {
        personeel.rang = nieuweRang;
        console.log(`[ROEPNUMMER] Rang automatisch aangepast van ${oudeRang} naar ${nieuweRang} voor roepnummer ${nieuwRoepnummer}`);
    }
    
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
    // Sync localStorage with database data (for UI state only)
    localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
    renderPersoneel();
    
    // Stuur bericht naar gebruiker over roepnummer wijziging
    if (personeel.discordId && typeof BerichtenSysteem !== 'undefined') {
        const berichtTekst = `Je roepnummer is gewijzigd naar ${personeel.roepnummer}.`;
        BerichtenSysteem.stuurBericht(personeel.discordId, 'roepnummer', berichtTekst);
    }
    
    // Toon notificatie met rang wijziging als die is gebeurd
    if (nieuweRang !== oudeRang) {
        toonNotificatie(`${personeel.naam} is verplaatst van ${oudeRang} naar ${nieuweRang} met roepnummer ${personeel.roepnummer}`);
    } else {
        toonNotificatie(`Roepnummer voor ${personeel.naam} bijgewerkt naar ${personeel.roepnummer}`);
    }
        
    // Log de roepnummer en rang wijziging
    if (nieuweRang !== oudeRang) {
        logPersoneelActie('roepnummer_en_rang_wijziging', personeel.naam, `Oud: ${oudeRang} (${oudRoepnummer}) -> Nieuw: ${nieuweRang} (${personeel.roepnummer})`);
    } else {
        logPersoneelActie('roepnummer_wijziging', personeel.naam, `Oud: ${oudRoepnummer} -> Nieuw: ${personeel.roepnummer}`);
    }
    
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
    
    // Sync localStorage with database data (for UI state only)
    localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
    
    sluitModal();
    toonNotificatie('Personeel succesvol toegevoegd');
}

// Bepaal rang op basis van roepnummer
function getRangVoorRoepnummer(roepnummer) {
    const rangDefinities = {
        '1e klasse': { min: '56-01', max: '56-20' },
        '2e klasse': { min: '56-21', max: '56-40' },
        '3e klasse': { min: '56-41', max: '56-80' },
        '4e klasse': { min: '56-81', max: '56-140' },
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
    
    for (const [rang, def] of Object.entries(rangDefinities)) {
        if (isRoepnummerInRange(roepnummer, def.min, def.max)) {
            return rang;
        }
    }
    
    return '4e klasse'; // Default fallback
}

// Helper functie om te checken of roepnummer in range valt
function isRoepnummerInRange(roepnummer, minRange, maxRange) {
    const [minPrefix, minNum] = minRange.split('-');
    const [maxPrefix, maxNum] = maxRange.split('-');
    const [prefix, num] = roepnummer.split('-');
    
    if (prefix !== minPrefix || prefix !== maxPrefix) {
        return false;
    }
    
    const numValue = parseInt(num);
    const minValue = parseInt(minNum);
    const maxValue = parseInt(maxNum);
    
    return numValue >= minValue && numValue <= maxValue;
}

// Get volgende roepnummer
function getVolgendeRoepnummer(rang) {
    const rangDefinities = {
        '1e klasse': { min: '56-01', max: '56-20' },
        '2e klasse': { min: '56-21', max: '56-40' },
        '3e klasse': { min: '56-41', max: '56-80' },
        '4e klasse': { min: '56-81', max: '56-140' },
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
async function verplaatsPersoneelNaarRang(personeelId, nieuweRang) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    const oudeRang = personeel.rang;
    personeel.rang = nieuweRang;
    
    // Wijs ALTIJD nieuw roepnummer toe bij rang verandering
    const roepnummer = getVolgendeRoepnummer(nieuweRang);
    personeel.roepnummer = roepnummer;
    
    // Save to API first
    try {
        const response = await fetch(`/api/roepnummer/personeel/${personeelId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rang: nieuweRang,
                roepnummer: roepnummer,
                naam: personeel.naam,
                discordId: personeel.discordId
            })
        });
        
        if (response.ok) {
            console.log('[ROEPNUMMER] Rang verandering succesvol opgeslagen in database');
        } else {
            console.error('[ROEPNUMMER] Fout bij opslaan rang verandering:', response.statusText);
        }
    } catch (error) {
        console.error('[ROEPNUMMER] API fout bij rang verandering:', error);
    }
    
    // Sync localStorage with database data (for UI state only)
    localStorage.setItem('roepnummerData', JSON.stringify(personeelData));
    
    // Re-render
    renderPersoneel();
    
    // Stuur bericht naar gebruiker over rang verandering
    if (personeel.discordId) {
        const berichtTekst = `Je rang is gewijzigd van ${oudeRang} naar ${nieuweRang} met nieuw roepnummer ${personeel.roepnummer}.`;
        
        // Wacht op BerichtenSysteem als het nog niet beschikbaar is
        const stuurBerichtMetRetry = () => {
            if (typeof BerichtenSysteem !== 'undefined') {
                BerichtenSysteem.stuurBericht(personeel.discordId, 'roepnummer', berichtTekst);
            } else {
                setTimeout(stuurBerichtMetRetry, 100);
            }
        };
        
        stuurBerichtMetRetry();
    }
    
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

// Reset database (alle personeel verwijderen)
async function resetDatabase() {
    if (confirm('Weet je zeker dat je alle personeel uit de database wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
        try {
            const response = await fetch('/api/roepnummer/personeel', {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('[ROEPNUMMER] Database gereset:', result);
                toonNotificatie(`Database gereset: ${result.deleted} personeel verwijderd`);
                
                // Clear localStorage en reload
                localStorage.removeItem('roepnummerData');
                location.reload();
            } else {
                console.error('[ROEPNUMMER] Fout bij resetten database');
                toonNotificatie('Fout bij resetten database');
            }
        } catch (error) {
            console.error('[ROEPNUMMER] API fout bij reset:', error);
            toonNotificatie('API fout bij resetten database');
        }
    }
}

// Blacklist personeel
async function blacklistPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) {
        toonNotificatie('Personeel niet gevonden');
        return;
    }

    // Toon bevestiging modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card">
            <h2>🚫 Persoon Blacklisten</h2>
            <div style="margin-bottom:16px">
                <p>Weet je zeker dat je <strong>${personeel.naam}</strong> wilt blacklisten?</p>
                <div style="background:#f87171;color:white;padding:12px;border-radius:4px;margin:12px 0">
                    <strong>Let op:</strong> Deze persoon zal worden verwijderd uit het personeelsbestand en toegevoegd aan de blacklist.
                </div>
            </div>
            <div class="form-group">
                <label>Reden voor blacklist</label>
                <select id="blacklist-reden" class="input-field">
                    <option value="">Selecteer reden...</option>
                    <option value="misdraging">Misdraging</option>
                    <option value="inactiviteit">Inactiviteit</option>
                    <option value="regels">Regel overtreding</option>
                    <option value="overig">Overig</option>
                </select>
            </div>
            <div class="form-group">
                <label>Beschrijving</label>
                <textarea id="blacklist-beschrijving" class="input-field" rows="3" placeholder="Gedetailleerde beschrijving..."></textarea>
            </div>
            <div style="display:flex;gap:10px;margin-top:8px">
                <button class="btn-red" style="flex:1" onclick="confirmBlacklist('${personeelId}')">Bevestigen</button>
                <button class="btn-ghost" style="flex:1" onclick="closeBlacklistModal()">Annuleren</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Sla huidige personeel ID op
    window.currentBlacklistPersoneelId = personeelId;
}

// Bevestig blacklist
async function confirmBlacklist(personeelId) {
    const reden = document.getElementById('blacklist-reden').value;
    const beschrijving = document.getElementById('blacklist-beschrijving').value;
    
    if (!reden || !beschrijving) {
        toonNotificatie('Vul alle velden in');
        return;
    }

    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;

    try {
        // Voeg toe aan blacklist
        const blacklistResponse = await fetch(`${API}/api/blacklist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                discord_id: personeel.discordId || personeel.discord,
                naam: personeel.naam,
                roepnummer: personeel.roepnummer,
                reden: reden,
                beschrijving: beschrijving,
                blacklisted_by: getUser().displayName || getUser().username || 'Systeem'
            })
        });

        if (!blacklistResponse.ok) {
            throw new Error('Fout bij toevoegen aan blacklist');
        }

        // Verwijder uit personeelsbestand
        const deleteResponse = await fetch(`/api/roepnummer/personeel/${personeelId}`, {
            method: 'DELETE'
        });

        if (!deleteResponse.ok) {
            throw new Error('Fout bij verwijderen personeel');
        }

        toonNotificatie(`${personeel.naam} is geblacklist en verwijderd uit het personeelsbestand`);
        closeBlacklistModal();
        
        // Reload data
        laadPersoneel();
        
        // Log actie
        logPersoneelActie('BLACKLIST', personeel.naam, `Reden: ${reden} - ${beschrijving}`);
        
    } catch (error) {
        console.error('Fout bij blacklisten:', error);
        toonNotificatie('Fout bij blacklisten van personeel');
    }
}

// Sluit blacklist modal
function closeBlacklistModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
    window.currentBlacklistPersoneelId = null;
}

// Make functions available globally for onclick handlers
window.promoveerPersoneel = promoveerPersoneel;
window.demoteerPersoneel = demoteerPersoneel;
window.ontslaPersoneel = ontslaPersoneel;
window.bewerkRoepnummer = bewerkRoepnummer;
window.slaRoepnummerOp = slaRoepnummerOp;
window.voegPersoneelToe = voegPersoneelToe;
window.openNieuwePersoneelModal = openNieuwePersoneelModal;
window.sluitModal = sluitModal;
window.sluitRoepnummerModal = sluitRoepnummerModal;
window.blacklistPersoneel = blacklistPersoneel;
window.confirmBlacklist = confirmBlacklist;
window.closeBlacklistModal = closeBlacklistModal;
window.resetDatabase = resetDatabase;
