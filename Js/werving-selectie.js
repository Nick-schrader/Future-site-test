// Nieuw Werving en Selectie Systeem
const API = window.location.origin;

// Globale variabelen
let tickets = [];
let gesprekken = [];
let currentUser = null;

// Access control check
window.onload = async () => {
  if (!localStorage.getItem('loggedIn')) { window.location.href = '../index.html'; return; }
  
  // Haal altijd verse rollen op voordat we de toegang checken
  await laadDiscordRollen();
  const u = getUser();
  const rollen = (u.rollen || []).map(r => r.naam || r);
  const specialDiscordId = '1196035736823156790';
  
  // Toegang voor Werving en Selectie, Kader, of speciale Discord ID
  if (!rollen.some(r => r.includes('Werving en Selectie')) && 
      !rollen.some(r => r.includes('Kader')) && 
      u.id !== specialDiscordId) {
    window.location.href = 'porto.html';
    return;
  }
  
  // Initialize page
  initializeWervingSelectie();
};

function initializeWervingSelectie() {
  loadCurrentUser();
  loadTickets();
  loadGesprekken();
}

// Get volgende roepnummer functie (zelfde als roepnummer.js)
async function getVolgendeRoepnummerForRang(rang) {
    try {
        // Haal bestaande personeel op om gebruikte roepnummers te checken
        const response = await fetch(`${API}/api/personeel`);
        const bestaandPersoneel = response.ok ? await response.json() : [];
        
        const rangDefinities = {
            '1e klasse': { min: '56-01', max: '56-20' },
            '2e klasse': { min: '56-21', max: '56-40' },
            '3e klasse': { min: '56-41', max: '56-80' },
            '4e klasse': { min: '56-81', max: '56-140' }
        };
        
        const definitie = rangDefinities[rang];
        if (!definitie) {
            console.error('[WERING] Onbekende rang:', rang);
            return null;
        }
        
        const minNum = parseInt(definitie.min.split('-')[1]);
        const maxNum = parseInt(definitie.max.split('-')[1]);
        
        // Haal bestaande roepnummers op voor deze rang
        const gebruikteNummers = bestaandPersoneel
            .filter(p => p.rang === rang && p.roepnummer)
            .map(p => parseInt(p.roepnummer.split('-')[1]));
        
        // Vind eerste beschikbare nummer
        for (let i = minNum; i <= maxNum; i++) {
            if (!gebruikteNummers.includes(i)) {
                return `56-${i.toString().padStart(2, '0')}`;
            }
        }
        
        console.warn('[WERING] Geen beschikbaar roepnummer voor rang:', rang);
        return null;
    } catch (error) {
        console.error('[WERING] Fout bij vinden roepnummer:', error);
        return null;
    }
}

// Initialiseer de pagina - nu via window.onload met access control

// Update dashboard statistieken
function updateDashboardStats() {
    const wachtend = tickets ? tickets.filter(t => t.status === 'wachtend').length : 0;
    const afgekeurd = tickets ? tickets.filter(t => t.status === 'afgekeurd').length : 0;
    const gesprekkenCount = gesprekken ? gesprekken.length : 0;
    const totaal = (tickets ? tickets.length : 0) + gesprekkenCount;

    document.getElementById('wachtend-count').textContent = wachtend;
    document.getElementById('afgekeurd-count').textContent = afgekeurd;
    document.getElementById('gesprekken-count').textContent = gesprekkenCount;
    document.getElementById('totaal-count').textContent = totaal;
    
    document.getElementById('wachtend-badge').textContent = wachtend;
    document.getElementById('gesprekken-badge').textContent = gesprekkenCount;
}

// Open sollicitant formulier popup
function openSollicitantForm() {
    document.getElementById('sollicitant-popup').classList.remove('hidden');
}

// Sluit sollicitant formulier popup
function sluitSollicitantPopup() {
    document.getElementById('sollicitant-popup').classList.add('hidden');
    // Leeg formulier
    document.getElementById('ingame-naam').value = '';
    document.getElementById('discord-id').value = '';
    document.getElementById('geboortedatum').value = '';
    document.getElementById('sollicitatie-nummer').value = '';
}

// Scroll naar sectie
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Laad huidige gebruiker
function loadCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        currentUser = JSON.parse(userStr);
    }
}

// Voeg sollicitant toe
async function voegSollicitantToe() {
    const ingameNaam = document.getElementById('ingame-naam').value.trim();
    const discordId = document.getElementById('discord-id').value.trim();
    const geboortedatum = document.getElementById('geboortedatum').value;
    const sollicitatieNummer = document.getElementById('sollicitatie-nummer').value.trim();

    // Valideer input
    if (!ingameNaam || !discordId || !geboortedatum || !sollicitatieNummer) {
        showToast('Vul alle verplichte velden in', 'error');
        return;
    }

    // Controleer blacklist
    await checkBlacklist(discordId, {
        ingameNaam,
        discordId,
        geboortedatum,
        sollicitatieNummer,
        aangemaaktDoor: currentUser?.displayName || currentUser?.username || 'Onbekend'
    });
}

// Controleer blacklist
async function checkBlacklist(discordId, sollicitantData) {
    try {
        const response = await fetch(`${API}/api/blacklist/check/${discordId}`);
        const result = await response.json();
        
        // Toon blacklist popup
        const modal = document.getElementById('blacklist-modal');
        const resultDiv = document.getElementById('blacklist-result');
        
        if (result.isBlacklisted) {
            resultDiv.innerHTML = `
                <div style="color:#ef4444">
                    <h4>⚠️ Persoon staat op de blacklist!</h4>
                    <p><strong>Reden:</strong> ${result.reason || 'Geen reden opgegeven'}</p>
                    ${result.beschrijving ? `<p><strong>Beschrijving:</strong> ${result.beschrijving}</p>` : ''}
                    <p><strong>Datum:</strong> ${result.date ? new Date(result.date).toLocaleDateString('nl-NL') : 'Onbekend'}</p>
                    ${result.blacklisted_by ? `<p><strong>Blacklisted door:</strong> ${result.blacklisted_by}</p>` : ''}
                    <p style="margin-top:12px">Sollicitatie kan niet worden voortgezet.</p>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div style="color:#22c55e">
                    <h4>✅ Persoon staat niet op de blacklist</h4>
                    <p>De sollicitatie kan worden voortgezet.</p>
                </div>
            `;
            
            // Maak ticket aan als niet op blacklist
            await maakTicketAan(sollicitantData);
        }
        
        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Fout bij blacklist controle:', error);
        showToast('Fout bij blacklist controle', 'error');
    }
}

// Maak ticket aan
async function maakTicketAan(sollicitantData) {
    try {
        const ticket = {
            id: Date.now().toString(),
            ingameNaam: sollicitantData.ingameNaam,
            discordId: sollicitantData.discordId,
            geboortedatum: sollicitantData.geboortedatum,
            sollicitatieNummer: sollicitantData.sollicitatieNummer,
            aangemaaktDoor: sollicitantData.aangemaaktDoor,
            status: 'wachtend',
            datum: new Date().toISOString()
        };
        
        console.log('[TICKET] Creating ticket with data:', ticket);

        const response = await fetch(`${API}/api/sollicitatie-tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ticket)
        });

        if (response.ok) {
            // Leeg formulier
            document.getElementById('ingame-naam').value = '';
            document.getElementById('discord-id').value = '';
            document.getElementById('geboortedatum').value = '';
            document.getElementById('sollicitatie-nummer').value = '';
            
            // Sluit popup
            sluitSollicitantPopup();
            
            // Reload tickets
            await loadTickets();
            showToast('Sollicitatie ticket aangemaakt!');
        } else {
            console.error('[WERING] CRITICAL: API not available for ticket storage');
            showToast('Database niet beschikbaar - kan geen ticket aanmaken', 'error');
            // NO localStorage fallback - must use database
        }
    } catch (error) {
        console.error('[WERING] CRITICAL: Database storage failed for ticket:', error);
        console.error('[WERING] Ticket could not be saved - this is a serious issue!');
        showToast('Fout bij aanmaken ticket - database niet bereikbaar', 'error');
        // NO localStorage fallback - must use database
    }
}

// localStorage storage functions removed - must use database
// function saveTicketToStorage() - DEPRECATED: Use database API instead

// Laad tickets
async function loadTickets() {
    try {
        console.log('[WERING] Loading tickets from database...');
        const response = await fetch(`${API}/api/sollicitatie-tickets`);
        if (response.ok) {
            tickets = await response.json();
            console.log('[WERING] Successfully loaded tickets from database:', tickets.length, 'items');
            displayTickets();
        } else {
            console.error('[WERING] CRITICAL: Database not available for tickets');
            showToast('Database niet beschikbaar - kan geen tickets laden', 'error');
            tickets = [];
            displayTickets();
        }
    } catch (error) {
        console.error('[WERING] CRITICAL: Database connection failed for tickets:', error);
        showToast('Database niet bereikbaar - kan geen tickets laden', 'error');
        tickets = [];
        displayTickets();
    }
}

// localStorage storage functions removed - must use database
// function loadTicketsFromStorage() - DEPRECATED: Use database API instead

// Toon tickets
function displayTickets() {
    const tbody = document.getElementById('tickets-tbody');
    
    console.log('[TICKET] Displaying tickets:', tickets);
    
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:#555;text-align:center">Geen sollicitatie tickets</td></tr>';
    } else {
        tbody.innerHTML = tickets.map(ticket => {
            console.log('[TICKET] Rendering ticket:', ticket);
            
            const statusBadge = getStatusBadge(ticket.status);
            const aangemaaktOp = new Date(ticket.datum).toLocaleDateString();
            
            return `
                <tr>
                    <td>${statusBadge}</td>
                    <td>${ticket.ingameNaam || 'undefined'}</td>
                    <td>${ticket.discordId || 'undefined'}</td>
                    <td>${ticket.sollicitatieNummer || 'undefined'}</td>
                    <td>
                        ${ticket.status === 'wachtend' ? `
                            <button class="btn-purple" onclick="beoordeelTicket('${ticket.id}')" style="padding:4px 8px;font-size:0.8rem">Beoordeel</button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Update dashboard statistieken
    updateDashboardStats();
}

// Laad gesprekken
async function loadGesprekken() {
    try {
        console.log('[WERING] Loading gesprekken from database...');
        const response = await fetch(`${API}/api/sollicitatie-gesprekken`);
        if (response.ok) {
            gesprekken = await response.json();
            console.log('[WERING] Successfully loaded gesprekken from database:', gesprekken.length, 'items');
            displayGesprekken();
        } else {
            console.error('[WERING] CRITICAL: Database not available for gesprekken');
            showToast('Database niet beschikbaar - kan geen gesprekken laden', 'error');
            gesprekken = [];
            displayGesprekken();
        }
    } catch (error) {
        console.error('[WERING] CRITICAL: Database connection failed for gesprekken:', error);
        showToast('Database niet bereikbaar - kan geen gesprekken laden', 'error');
        gesprekken = [];
        displayGesprekken();
    }
}

// localStorage storage functions removed - must use database
// function loadGesprekkenFromStorage() - DEPRECATED: Use database API instead

// Toon gesprekken
function displayGesprekken() {
    const tbody = document.getElementById('gesprekken-tbody');
    
    if (gesprekken.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:#555;text-align:center">Geen gesprekken</td></tr>';
    } else {
        tbody.innerHTML = gesprekken.map(gesprek => {
            const datum = new Date(gesprek.datum).toLocaleDateString();
            const notitie = gesprek.notitie || 'Geen notitie';
            
            return `
                <tr>
                    <td>${gesprek.ingameNaam}</td>
                    <td>${gesprek.discordId}</td>
                    <td>${gesprek.aangemaaktDoor || 'Onbekend'}</td>
                    <td>${gesprek.goedgekeurdDoor}</td>
                    <td>${datum}</td>
                    <td>
                        <button class="btn-green" onclick="finaliseerGesprek('${gesprek.id}')" style="padding:4px 8px;font-size:0.8rem">Goedkeuren</button>
                        <button class="btn-red" onclick="keurGesprekAf('${gesprek.id}')" style="padding:4px 8px;font-size:0.8rem;margin-left:4px">Afkeuren</button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Update dashboard statistieken
    updateDashboardStats();
}

// Beoordeel ticket
function beoordeelTicket(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    // Vul modal met ticket data
    document.getElementById('ticket-ingame-naam').value = ticket.ingameNaam;
    document.getElementById('ticket-discord-id').value = ticket.discordId;
    document.getElementById('ticket-geboortedatum').value = new Date(ticket.geboortedatum).toLocaleDateString();
    document.getElementById('ticket-sollicitatie-nummer').value = ticket.sollicitatieNummer;

    // Sla ticket ID op voor later gebruik
    window.currentTicketId = ticketId;

    // Open modal
    document.getElementById('ticket-modal').classList.remove('hidden');
}

// Keur ticket goed
async function keurTicketGoed() {
    const ticketId = window.currentTicketId;
    if (!ticketId) return;

    try {
        // Update ticket status via API
        const response = await fetch(`${API}/api/sollicitatie-tickets/${ticketId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'goedgekeurd',
                goedgekeurdDoor: currentUser?.displayName || currentUser?.username || 'Onbekend'
            })
        });

        if (response.ok) {
            // Verwijder ticket via API
            await fetch(`${API}/api/sollicitatie-tickets/${ticketId}`, {
                method: 'DELETE'
            });

            // Maak gesprek aan via API
            const ticket = tickets.find(t => t.id === ticketId);
            const gesprek = {
                id: Date.now().toString(),
                ingameNaam: ticket.ingameNaam,
                discordId: ticket.discordId,
                aangemaaktDoor: ticket.aangemaaktDoor || 'Onbekend',
                goedgekeurdDoor: currentUser?.displayName || currentUser?.username || 'Onbekend',
                datum: new Date().toISOString(),
                notitie: null
            };

            await fetch(`${API}/api/sollicitatie-gesprekken`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(gesprek)
            });

            // Functie om naam af te korten (eerste deel + eerste letter van tweede deel)
            function afkortNaam(volledigeNaam) {
                const delen = volledigeNaam.split(' ');
                if (delen.length >= 2) {
                    return delen[0] + ' ' + delen[1].charAt(0) + '.';
                }
                return volledigeNaam; // Als er geen tweede deel is, return volledige naam
            }

            // Gebruik dezelfde roepnummer logica als voegPersoneelToe
            // Importeer de getVolgendeRoepnummer functie van roepnummer.js
            const roepnummer = await getVolgendeRoepnummerForRang('4e klasse');
            
            // Voeg personeel toe aan roepnummer systeem als 4e klasse
            const personeelData = {
                naam: afkortNaam(ticket.ingameNaam),
                discordId: ticket.discordId,
                rang: '4e klasse',
                roepnummer: roepnummer
            };
            
            console.log('[WERING] Personeel data voor roepnummer systeem:', personeelData);

            await fetch(`${API}/api/personeel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(personeelData)
            });

            // Voeg toe aan logs
            const logData = {
                actie: 'Sollicitant goedgekeurd',
                door: currentUser?.displayName || currentUser?.username || 'Onbekend',
                doelwit: `${ticket.ingameNaam} (${ticket.discordId})`,
                details: `${ticket.ingameNaam} (${ticket.discordId}) is goedgekeurd door ${currentUser?.displayName || currentUser?.username || 'Onbekend'}`,
                timestamp: new Date().toISOString()
            };

            await fetch(`${API}/api/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logData)
            });

            // Update displays
            sluitTicketModal();
            await loadTickets();
            await loadGesprekken();
            updateDashboardStats();
            showToast('Ticket goedgekeurd!');
        } else {
            console.error('[WERING] CRITICAL: Database operations failed for ticket approval');
            showToast('Database niet beschikbaar - kan geen ticket goedkeuren', 'error');
            // NO localStorage fallback - must use database
        }
    } catch (error) {
        console.error('[WERING] CRITICAL: Database operations failed for ticket approval:', error);
        showToast('Database niet bereikbaar - kan geen ticket goedkeuren', 'error');
        // NO localStorage fallback - must use database
    }
}

// localStorage storage functions removed - must use database
// function keurTicketGoedInStorage() - DEPRECATED: Use database API instead

// Keur ticket af
async function keurTicketAf() {
    const ticketId = window.currentTicketId;
    if (!ticketId) return;

    try {
        console.log('[TICKET] Afkeuren ticket:', ticketId);
        
        // Verwijder ticket direct uit API (geen status update nodig)
        const response = await fetch(`${API}/api/sollicitatie-tickets/${ticketId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log('[TICKET] Ticket succesvol verwijderd na afkeuring');
            
            // Laad tickets opnieuw van API om data consistent te houden
            await loadTickets();
            
            sluitTicketModal();
            showToast('Ticket afgekeurd en verwijderd');
        } else {
            throw new Error('Failed to delete ticket');
        }
    } catch (error) {
        console.error('Fout bij afkeuren ticket:', error);
        showToast('Fout bij afkeuren ticket', 'error');
    }
}

// Plan gesprek
async function planGesprek() {
    const gesprekId = window.currentGesprekId;
    if (!gesprekId) return;

    const notitie = document.getElementById('gesprek-notitie').value.trim();

    try {
        await fetch(`${API}/api/sollicitatie-gesprekken/${gesprekId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                notitie: notitie || null
            })
        });

        sluitGesprekModal();
        await loadGesprekken();
        showToast('Gesprek gepland met notitie!');
    } catch (error) {
        console.error('Fout bij plannen gesprek:', error);
        showToast('Fout bij plannen gesprek', 'error');
    }
}

// Finaliseer gesprek - voeg toe aan roepnummer bestand
async function finaliseerGesprek(gesprekId) {
    const gesprek = gesprekken.find(g => g.id === gesprekId);
    if (!gesprek) return;

    try {
        // Gebruik zelfde roepnummer logica als voegPersoneelToe
        const roepnummer = await getVolgendeRoepnummerForRang('4e klasse');

        // Functie om naam af te korten (eerste deel + eerste letter van tweede deel)
        function afkortNaam(volledigeNaam) {
            const delen = volledigeNaam.split(' ');
            if (delen.length >= 2) {
                return delen[0] + ' ' + delen[1].charAt(0) + '.';
            }
            return volledigeNaam;
        }

        // Voeg toe aan personeel met juiste data structuur
        const personeelData = {
            naam: afkortNaam(gesprek.ingameNaam),
            discordId: gesprek.discordId,
            rang: '4e klasse',
            roepnummer: roepnummer
        };

        await fetch(`${API}/api/personeel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(personeelData)
        });

        // Verwijder gesprek
        await fetch(`${API}/api/sollicitatie-gesprekken/${gesprekId}`, {
            method: 'DELETE'
        });

        // Voeg toe aan logs
        const logData = {
            actie: 'Gesprek goedgekeurd',
            door: currentUser?.displayName || currentUser?.username || 'Onbekend',
            doelwit: `${gesprek.ingameNaam} (${gesprek.discordId})`,
            details: `Goedgekeurd na gesprek - Roepnummer: ${roepnummer}`,
            timestamp: new Date().toISOString()
        };

        await fetch(`${API}/api/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(logData)
        });

        await loadGesprekken();
        showToast(`${gesprek.ingameNaam} is toegevoegd aan het personeelsbestand met roepnummer ${roepnummer}!`);
    } catch (error) {
        console.error('Fout bij finaliseren gesprek:', error);
        showToast('Fout bij finaliseren gesprek', 'error');
    }
}

// Keur gesprek af
async function keurGesprekAf(gesprekId) {
    const gesprek = gesprekken.find(g => g.id === gesprekId);
    if (!gesprek) return;

    try {
        console.log('[GESPREK] Afkeuren gesprek:', gesprekId);
        
        // Verwijder gesprek direct uit API
        const response = await fetch(`${API}/api/sollicitatie-gesprekken/${gesprekId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            console.log('[GESPREK] Gesprek succesvol verwijderd na afkeuring');
            
            // Voeg toe aan logs
            const logData = {
                actie: 'Gesprek afgekeurd',
                door: currentUser?.displayName || currentUser?.username || 'Onbekend',
                doelwit: `${gesprek.ingameNaam} (${gesprek.discordId})`,
                details: `Afgekeurd na gesprek`,
                timestamp: new Date().toISOString()
            };

            await fetch(`${API}/api/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logData)
            });
            
            // Laad gesprekken opnieuw van API om data consistent te houden
            await loadGesprekken();
            showToast('Gesprek afgekeurd en verwijderd');
        } else {
            throw new Error('Failed to delete gesprek');
        }
    } catch (error) {
        console.error('Fout bij afkeuren gesprek:', error);
        showToast('Fout bij afkeuren gesprek', 'error');
    }
}

// Genereer roepnummer
function genereerRoepnummer() {
    // Eenvoudige roepnummer generatie - kan later worden verbeterd
    const nummer = Math.floor(Math.random() * 9000) + 1000;
    return `55-${nummer}`;
}

// Helper functies
function getStatusBadge(status) {
    const badges = {
        'wachtend': '<span style="background:#f59e0b;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem">⏳ Wachtend</span>',
        'goedgekeurd': '<span style="background:#22c55e;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem">✅ Goedgekeurd</span>',
        'afgekeurd': '<span style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;font-size:0.7rem">❌ Afgekeurd</span>'
    };
    return badges[status] || status;
}

// Modal functies
function sluitBlacklistModal() {
    document.getElementById('blacklist-modal').classList.add('hidden');
}

function sluitTicketModal() {
    document.getElementById('ticket-modal').classList.add('hidden');
    window.currentTicketId = null;
}

function sluitGesprekModal() {
    document.getElementById('gesprek-modal').classList.add('hidden');
    window.currentGesprekId = null;
}

// Toast notificatie
function showToast(bericht, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast hidden';
        document.body.appendChild(toast);
    }
    
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span> <span>${bericht}</span>`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function hideToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.add('hidden');
    }
}
