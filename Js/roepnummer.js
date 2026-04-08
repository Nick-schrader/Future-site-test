// Roepnummer Bestand - JavaScript Functionaliteit
const API_URL = 'https://future-site-test-production.up.railway.app';
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

// Helper functie om user data te krijgen
function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
        return {};
    }
}

// Initialiseer de pagina
document.addEventListener('DOMContentLoaded', function() {
    checkPermissies();
    laadPersoneel();
    setupEventListeners();
});

// Controleer of gebruiker Administratie rol heeft
function checkPermissies() {
    const user = getUser();
    if (!user || !user.discordRoles) {
        toonGeenToegang();
        return;
    }
    
    const discordRoles = Array.isArray(user.discordRoles) ? user.discordRoles : [];
    const rolNamen = discordRoles.map(r => r.name || '');
    
    const heeftAdministratie = rolNamen.some(rol => 
        rol.toLowerCase().includes('administratie') || 
        rol.toLowerCase().includes('admin') ||
        rol.toLowerCase().includes('beheer')
    );
    
    if (!heeftAdministratie) {
        toonGeenToegang();
    } else {
        currentUser = user;
        document.getElementById('nieuwePersoneelBtn').style.display = 'block';
        console.log(' Administratie permissie bevestigd voor:', user.displayName);
    }
}

// Toon geen toegang bericht
function toonGeenToegang() {
    document.querySelector('.roepnummer-container').innerHTML = `
        <div class="geen-toegang">
            <h2> Geen Toegang</h2>
            <p>Je hebt <strong>Administratie</strong> Discord rol nodig om het roepnummer bestand te beheren.</p>
            <p>Neem contact op met een beheerder als je denkt dat je toegang moet hebben.</p>
            <button onclick="window.location.href='porto.html'">Terug naar Porto</button>
        </div>
    `;
}

// Setup event listeners
function setupEventListeners() {
    // Nieuw personeel knop
    document.getElementById('nieuwePersoneelBtn').addEventListener('click', openNieuwePersoneelModal);
    
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
        personeelData = await response.json();
        renderPersoneel();
    } catch (error) {
        console.error('Fout bij laden personeel:', error);
        personeelData = [];
        renderPersoneel();
    }
}

// Render personeel in de juiste rang secties
function renderPersoneel() {
    // Clear alle personeel lijsten
    document.querySelectorAll('.personeel-lijst').forEach(lijst => {
        lijst.innerHTML = '';
    });
    
    personeelData.forEach(personeel => {
        const rangSectie = document.querySelector(`.personeel-lijst[data-rang="${personeel.rang}"]`);
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
            <button class="btn-small btn-demotion" onclick="demoteerPersoneel('${personeel.id}')" title="Demoteren"> </button>
            <button class="btn-small btn-promoveer" onclick="promoveerPersoneelKnop('${personeel.id}')" title="Promoveren"> </button>
            <button class="btn-small btn-ontsla" onclick="ontslaPersoneel('${personeel.id}')" title="Ontslaan"> </button>
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
