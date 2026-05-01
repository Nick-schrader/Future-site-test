// Team Evaluatie Systeem voor Werving en Selectie
const API = window.location.origin;

// Globale variabelen
let evaluatieData = [];
let currentUser = null;

// Initialiseer de pagina
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser();
    loadEvaluaties();
    updateStatistics();
});

// Laad huidige gebruiker
function loadCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        currentUser = JSON.parse(userStr);
    }
}

// Controleer blacklist
async function checkBlacklist(discordId) {
    try {
        const response = await fetch(`${API}/api/blacklist/check/${discordId}`);
        const result = await response.json();
        return result.isBlacklisted;
    } catch (error) {
        console.error('Fout bij blacklist controle:', error);
        return false;
    }
}

// Laad evaluaties
async function loadEvaluaties() {
    try {
        const response = await fetch(`${API}/api/evaluaties`);
        if (response.ok) {
            evaluatieData = await response.json();
            await displayEvaluaties();
            updateStatistics();
        }
    } catch (error) {
        console.error('Fout bij laden evaluaties:', error);
        // Start met lege data als API niet beschikbaar is
        evaluatieData = [];
        await displayEvaluaties();
        updateStatistics();
    }
}

// Submit evaluatie via formulier
async function submitEvaluatie() {
    const discordNaam = document.getElementById('eval-discord-naam').value.trim();
    const discordId = document.getElementById('eval-discord-id').value.trim();
    const roepnummer = document.getElementById('eval-roepnummer').value.trim();
    const team = document.getElementById('eval-team').value.trim();
    const beoordeling = document.getElementById('eval-beoordeling').value;

    if (!discordNaam || !discordId || !roepnummer || !team || !beoordeling) {
        toonNotificatie('Vul alle velden in', 'error');
        return;
    }

    const evaluatie = {
        discordNaam,
        discordId,
        roepnummer,
        team,
        beoordeling,
        opmerkingen: '',
        datum: new Date().toISOString(),
        geëvalueerdDoor: currentUser?.displayName || currentUser?.username || 'Onbekend'
    };

    try {
        const response = await fetch(`${API}/api/evaluaties`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(evaluatie)
        });

        if (response.ok) {
            // Update displays
            await loadEvaluaties();
            
            // Clear formulier
            document.getElementById('eval-discord-naam').value = '';
            document.getElementById('eval-discord-id').value = '';
            document.getElementById('eval-roepnummer').value = '';
            document.getElementById('eval-team').value = '';
            document.getElementById('eval-beoordeling').value = '';
            
            toonNotificatie('Evaluatie succesvol toegevoegd!');
        } else {
            throw new Error('Fout bij opslaan evaluatie');
        }
    } catch (error) {
        console.error('Fout bij submit evaluatie:', error);
        toonNotificatie('Fout bij opslaan evaluatie', 'error');
    }
}

// Submit evaluatie via modal
async function submitModalEvaluatie() {
    const discordNaam = document.getElementById('modal-discord-naam').value.trim();
    const discordId = document.getElementById('modal-discord-id').value.trim();
    const roepnummer = document.getElementById('modal-roepnummer').value.trim();
    const team = document.getElementById('modal-team').value.trim();
    const beoordeling = document.getElementById('modal-beoordeling').value;
    const opmerkingen = document.getElementById('modal-opmerkingen').value.trim();

    if (!discordNaam || !discordId || !roepnummer || !team || !beoordeling) {
        toonNotificatie('Vul alle verplichte velden in', 'error');
        return;
    }

    const evaluatie = {
        discordNaam,
        discordId,
        roepnummer,
        team,
        beoordeling,
        opmerkingen,
        datum: new Date().toISOString(),
        geëvalueerdDoor: currentUser?.displayName || currentUser?.username || 'Onbekend'
    };

    try {
        const response = await fetch(`${API}/api/evaluaties`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(evaluatie)
        });

        if (response.ok) {
            // Update displays
            await loadEvaluaties();
            
            // Sluit modal
            closeEvaluatieModal();
            
            toonNotificatie('Evaluatie succesvol toegevoegd!');
        } else {
            throw new Error('Fout bij opslaan evaluatie');
        }
    } catch (error) {
        console.error('Fout bij submit evaluatie:', error);
        toonNotificatie('Fout bij opslaan evaluatie', 'error');
    }
}

// Open evaluatie modal
function openEvaluatieModal() {
    document.getElementById('evaluatie-modal').classList.remove('hidden');
}

// Sluit evaluatie modal
function closeEvaluatieModal() {
    document.getElementById('evaluatie-modal').classList.add('hidden');
    
    // Clear modal fields
    document.getElementById('modal-discord-naam').value = '';
    document.getElementById('modal-discord-id').value = '';
    document.getElementById('modal-roepnummer').value = '';
    document.getElementById('modal-team').value = '';
    document.getElementById('modal-beoordeling').value = '';
    document.getElementById('modal-opmerkingen').value = '';
}

// Toon notificatie
function toonNotificatie(bericht, type = 'success') {
    // Maak toast element als het niet bestaat
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast hidden';
        document.body.appendChild(toast);
    }
    
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> <span>${bericht}</span>`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Update statistieken
function updateStatistics() {
    const stats = {
        totaal: evaluatieData.length,
        goedgekeurd: evaluatieData.filter(e => e.beoordeling === 'goedgekeurd').length,
        afgekeurd: evaluatieData.filter(e => e.beoordeling === 'afgekeurd').length,
        twijfelachtig: evaluatieData.filter(e => e.beoordeling === 'twijfelachtig').length,
        blacklist: evaluatieData.filter(e => e.beoordeling === 'blacklist').length
    };

    document.getElementById('eval-totaal').textContent = stats.totaal;
    document.getElementById('eval-goedgekeurd').textContent = stats.goedgekeurd;
    document.getElementById('eval-twijfel').textContent = stats.twijfelachtig;
    document.getElementById('eval-blacklist').textContent = stats.blacklist;
}

// Groepeer evaluaties per sollicitant
function groepeerEvaluatiesPerSollicitant() {
    const gegroepeerd = {};
    
    evaluatieData.forEach(evaluatie => {
        const key = `${evaluatie.discordId}-${evaluatie.discordNaam}`;
        if (!gegroepeerd[key]) {
            gegroepeerd[key] = {
                discordId: evaluatie.discordId,
                discordNaam: evaluatie.discordNaam,
                roepnummer: evaluatie.roepnummer,
                evaluaties: [],
                teams: new Set()
            };
        }
        gegroepeerd[key].evaluaties.push(evaluatie);
        gegroepeerd[key].teams.add(evaluatie.team);
    });
    
    return gegroepeerd;
}

// Bepaal consensus voor sollicitant
function bepaalConsensus(evaluaties) {
    const beoordelingen = evaluaties.map(e => e.beoordeling);
    const uniekeBeoordelingen = [...new Set(beoordelingen)];
    
    // Als iedereen hetzelfde vindt
    if (uniekeBeoordelingen.length === 1) {
        return {
            status: uniekeBeoordelingen[0],
            consensus: 100,
            teams: evaluaties.map(e => e.team)
        };
    }
    
    // Bereken percentages
    const percentages = {};
    beoordelingen.forEach(beoordeling => {
        percentages[beoordeling] = (percentages[beoordeling] || 0) + 1;
    });
    
    Object.keys(percentages).forEach(key => {
        percentages[key] = (percentages[key] / beoordelingen.length) * 100;
    });
    
    // Bepaal status op basis van percentages
    let status = 'twijfelachtig';
    if (percentages.goedgekeurd >= 70) {
        status = 'goedgekeurd';
    } else if (percentages.blacklist >= 50) {
        status = 'blacklist';
    } else if (percentages.afgekeurd >= 70) {
        status = 'afgekeurd';
    }
    
    return {
        status,
        consensus: Math.max(...Object.values(percentages)),
        teams: evaluaties.map(e => e.team),
        percentages
    };
}

// Toon evaluaties
async function displayEvaluaties() {
    const gegroepeerd = groepeerEvaluatiesPerSollicitant();
    
    // Lege tabellen
    document.getElementById('goedgekeurd-tbody').innerHTML = '<tr><td colspan="6" style="color:#555;text-align:center">Geen goedgekeurde sollicitanten</td></tr>';
    document.getElementById('twijfel-tbody').innerHTML = '<tr><td colspan="6" style="color:#555;text-align:center">Geen twijfelachtige sollicitanten</td></tr>';
    document.getElementById('blacklist-tbody').innerHTML = '<tr><td colspan="6" style="color:#555;text-align:center">Geen blacklist sollicitanten</td></tr>';
    
    for (const sollicitant of Object.values(gegroepeerd)) {
        const consensus = bepaalConsensus(sollicitant.evaluaties);
        const teams = Array.from(sollicitant.teams).join(', ');
        
        // Check blacklist status
        let blacklistStatus = '';
        try {
            const isBlacklisted = await checkBlacklist(sollicitant.discordId);
            if (isBlacklisted) {
                blacklistStatus = '<span style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem">🚫 BLACKLIST</span>';
            }
        } catch (error) {
            console.error('Fout bij blacklist controle:', error);
        }
        
        const row = `
            <tr>
                <td>${sollicitant.discordNaam}${blacklistStatus ? '<br>' + blacklistStatus : ''}</td>
                <td>${sollicitant.discordId}</td>
                <td>${sollicitant.roepnummer}</td>
                <td>${teams}</td>
                <td>${Math.round(consensus.consensus)}%</td>
                <td>
                    <button class="btn-ghost" onclick="toonDetails('${sollicitant.discordId}')" style="padding:4px 8px;font-size:0.8rem;margin-right:4px">Details</button>
                    <button class="btn-purple" onclick="beoordeelSollicitant('${sollicitant.discordId}', '${sollicitant.discordNaam}')" style="padding:4px 8px;font-size:0.8rem">Beoordeel</button>
                </td>
            </tr>
        `;
        
        if (consensus.status === 'goedgekeurd') {
            document.getElementById('goedgekeurd-tbody').innerHTML = row + document.getElementById('goedgekeurd-tbody').innerHTML;
        } else if (consensus.status === 'twijfelachtig' || consensus.status === 'afgekeurd') {
            document.getElementById('twijfel-tbody').innerHTML = row + document.getElementById('twijfel-tbody').innerHTML;
        } else if (consensus.status === 'blacklist') {
            document.getElementById('blacklist-tbody').innerHTML = row + document.getElementById('blacklist-tbody').innerHTML;
        }
    }
}

// Toon details van sollicitant
function toonDetails(discordId) {
    const gegroepeerd = groepeerEvaluatiesPerSollicitant();
    const sollicitant = Object.values(gegroepeerd).find(s => s.discordId === discordId);
    
    if (!sollicitant) return;
    
    let details = `Evaluaties voor ${sollicitant.discordNaam}:\n\n`;
    sollicitant.evaluaties.forEach(evaluatie => {
        details += `Team: ${evaluatie.team}\n`;
        details += `Beoordeling: ${evaluatie.beoordeling}\n`;
        details += `Datum: ${new Date(evaluatie.datum).toLocaleDateString()}\n`;
        if (evaluatie.opmerkingen) {
            details += `Opmerkingen: ${evaluatie.opmerkingen}\n`;
        }
        details += '\n';
    });
    
    alert(details);
}

// Beoordeel sollicitant
function beoordeelSollicitant(discordId, discordNaam) {
    const gegroepeerd = groepeerEvaluatiesPerSollicitant();
    const sollicitant = Object.values(gegroepeerd).find(s => s.discordId === discordId);
    
    if (!sollicitant) return;
    
    // Vul modal met sollicitant data
    document.getElementById('modal-discord-naam').value = sollicitant.discordNaam;
    document.getElementById('modal-discord-id').value = sollicitant.discordId;
    document.getElementById('modal-roepnummer').value = sollicitant.roepnummer;
    document.getElementById('modal-team').value = currentUser?.displayName || currentUser?.username || 'Onbekend';
    
    // Open modal
    openEvaluatieModal();
}

// Filter evaluaties
async function filterEvaluaties() {
    const searchTerm = document.getElementById('eval-search').value.toLowerCase();
    
    // Filter op basis van zoekterm
    const gefilterd = evaluatieData.filter(evaluatie => 
        evaluatie.discordNaam.toLowerCase().includes(searchTerm) ||
        evaluatie.discordId.toLowerCase().includes(searchTerm) ||
        evaluatie.roepnummer.toLowerCase().includes(searchTerm) ||
        evaluatie.team.toLowerCase().includes(searchTerm)
    );
    
    // Update display met gefilterde data
    const origineleData = evaluatieData;
    evaluatieData = gefilterd;
    await displayEvaluaties();
    evaluatieData = origineleData;
}

