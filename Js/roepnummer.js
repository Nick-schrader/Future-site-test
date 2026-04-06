// Roepnummer Bestand Beheersysteem
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

// Initialiseer de pagina
document.addEventListener('DOMContentLoaded', function() {
    checkPermissies();
    laadPersoneel();
    setupEventListeners();
    updateStatistieken();
});

// Controleer of gebruiker Administratie rol heeft
function checkPermissies() {
    const user = getUser();
    if (!user || !user.rollen) {
        toonGeenToegang();
        return;
    }
    
    const rollen = Array.isArray(user.rollen) ? user.rollen : JSON.parse(user.rollen || '[]');
    const rolNamen = rollen.map(r => typeof r === 'string' ? r : (r.naam || ''));
    
    const heeftAdministratie = rolNamen.some(rol => 
        rol.toLowerCase().includes('administratie') || 
        rol.toLowerCase().includes('admin')
    );
    
    if (!heeftAdministratie) {
        toonGeenToegang();
    } else {
        currentUser = user;
        console.log('✅ Administratie permissie bevestigd voor:', user.displayName);
    }
}

// Toon geen toegang bericht
function toonGeenToegang() {
    document.querySelector('.roepnummer-container').innerHTML = `
        <div style="text-align: center; padding: 50px; background: #1a1a2e; border-radius: 12px; margin: 50px auto; max-width: 500px;">
            <h2 style="color: #ef4444; margin-bottom: 20px;">🚫 Geen Toegang</h2>
            <p style="color: #888; font-size: 1.1rem; line-height: 1.6;">
                Je hebt geen <strong>Administratie</strong> rol nodig om het roepnummer bestand te beheren.
            </p>
            <p style="color: #888; margin-top: 15px;">
                Neem contact op met een beheerder als je denkt dat je toegang moet hebben.
            </p>
            <button onclick="window.location.href='porto.html'" style="
                background: #8b5cf6; 
                color: white; 
                border: none; 
                padding: 12px 24px; 
                border-radius: 8px; 
                cursor: pointer; 
                margin-top: 20px;
                font-size: 1rem;
            ">
                ← Terug naar Porto
            </button>
        </div>
    `;
}

// Setup event listeners
function setupEventListeners() {
    // Nieuw personeel knop
    document.getElementById('nieuwePersoneelBtn').addEventListener('click', openNieuwePersoneelModal);
    
    // Zoekbalk
    document.getElementById('zoekBox').addEventListener('input', filterPersoneel);
    
    // Modal sluiten
    document.getElementById('nieuwePersoneelModal').addEventListener('click', function(e) {
        if (e.target === this) sluitModal();
    });
    
    // Setup drag and drop voor alle personeel lijsten
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        setupDragAndDrop(lijst);
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
        const nieuweRang = this.parentElement.dataset.rang;
        
        if (personeelId && nieuweRang) {
            promoveerPersoneel(personeelId, nieuweRang);
        }
    });
}

// Laad personeel data
async function laadPersoneel() {
    try {
        const response = await fetch(`${API_URL}/api/roepnummer-bestand`);
        personeelData = await response.json();
        renderPersoneel();
        updateStatistieken();
    } catch (error) {
        console.error('Fout bij laden personeel:', error);
        // Fallback lege data als API niet beschikbaar is
        personeelData = [];
        renderPersoneel();
        updateStatistieken();
    }
}

// Render personeel in de juiste rang secties
function renderPersoneel() {
    // Clear alle personeel lijsten
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        lijst.innerHTML = '';
    });
    
    personeelData.forEach(personeel => {
        const rangSectie = document.querySelector(`[data-rang="${personeel.rang}"] .personeel-lijst`);
        if (rangSectie) {
            rangSectie.appendChild(createPersoneelRij(personeel));
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
    
    div.innerHTML = `
        <div class="personeel-info">
            <div class="personeel-avatar">${avatarInitialen}</div>
            <div class="personeel-details">
                <div class="personeel-naam">${personeel.naam}</div>
                <div class="personeel-discord">Discord ID: ${personeel.discordId}</div>
            </div>
        </div>
        <div class="personeel-roepnummer">${personeel.roepnummer || 'Nog niet toegewezen'}</div>
        <div class="personeel-acties">
            <button class="btn-small btn-demotion" onclick="demoteerPersoneel('${personeel.id}')" title="Demoteren">↓</button>
            <button class="btn-small btn-promoveer" onclick="promoveerPersoneelKnop('${personeel.id}')" title="Promoveren">↑</button>
            <button class="btn-small btn-ontsla" onclick="ontslaPersoneel('${personeel.id}')" title="Ontslaan">✕</button>
        </div>
    `;
    
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
    
    try {
        await savePersoneel(nieuwPersoneel);
        personeelData.push(nieuwPersoneel);
        renderPersoneel();
        updateStatistieken();
        sluitModal();
        showToast('Personeel succesvol toegevoegd');
    } catch (error) {
        console.error('Fout bij toevoegen personeel:', error);
        alert('Fout bij toevoegen personeel');
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
    
    try {
        await savePersoneel(personeel);
        renderPersoneel();
        updateStatistieken();
        showToast(`${personeel.naam} gepromoveerd van ${oudeRang} naar ${nieuweRang}`);
    } catch (error) {
        console.error('Fout bij promoveren:', error);
        alert('Fout bij promoveren personeel');
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

// Ontsla personeel
async function ontslaPersoneel(personeelId) {
    const personeel = personeelData.find(p => p.id === personeelId);
    if (!personeel) return;
    
    if (!confirm(`Weet je zeker dat je ${personeel.naam} wilt ontslaan?`)) {
        return;
    }
    
    try {
        await deletePersoneel(personeelId);
        personeelData = personeelData.filter(p => p.id !== personeelId);
        renderPersoneel();
        updateStatistieken();
        showToast(`${personeel.naam} is ontslagen`);
    } catch (error) {
        console.error('Fout bij ontslaan personeel:', error);
        alert('Fout bij ontslaan personeel');
    }
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

// Filter personeel op zoekterm
function filterPersoneel() {
    const zoekTerm = document.getElementById('zoekBox').value.toLowerCase();
    
    document.querySelectorAll('.personeel-rij').forEach(rij => {
        const personeelId = rij.dataset.personeelId;
        const personeel = personeelData.find(p => p.id === personeelId);
        
        if (personeel) {
            const matchNaam = personeel.naam.toLowerCase().includes(zoekTerm);
            const matchRoepnummer = personeel.roepnummer && personeel.roepnummer.toLowerCase().includes(zoekTerm);
            const matchDiscord = personeel.discordId.toLowerCase().includes(zoekTerm);
            
            rij.style.display = (matchNaam || matchRoepnummer || matchDiscord) ? 'flex' : 'none';
        }
    });
}

// Update statistieken
function updateStatistieken() {
    const stats = {
        totaal: personeelData.length,
        manschappen: personeelData.filter(p => rangDefinities[p.rang]?.categorie === 'manschappen').length,
        corporaals: personeelData.filter(p => rangDefinities[p.rang]?.categorie === 'korporaals').length,
        officieren: personeelData.filter(p => {
            const cat = rangDefinities[p.rang]?.categorie;
            return cat === 'officieren' || cat === 'hoofdofficieren' || cat === 'kader';
        }).length
    };
    
    document.getElementById('totaalPersoneel').textContent = stats.totaal;
    document.getElementById('totaalManschappen').textContent = stats.manschappen;
    document.getElementById('totaalKorporaals').textContent = stats.corporaals;
    document.getElementById('totaalOfficieren').textContent = stats.officieren;
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

// Toast notification (gebruik bestaande uit porto.js als beschikbaar)
function showToast(message) {
    if (typeof window.showToast === 'function') {
        window.showToast(message);
    } else {
        // Fallback toast
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
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }
}
