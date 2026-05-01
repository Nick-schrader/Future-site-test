// Nieuw Werving en Selectie Systeem
const API = window.location.origin;

// Globale variabelen
let tickets = [];
let gesprekken = [];
let currentUser = null;

// Get volgende roepnummer functie (zelfde als roepnummer.js)
async function getVolgendeRoepnummerForRang(rang) {
    try {
        // Haal bestaande personeel op om gebruikte roepnummers te checken
        const response = await fetch(`${API}/api/roepnummer/personeel`);
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

// Initialiseer de pagina
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser();
    loadTickets();
    loadGesprekken();
});

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
            // Fallback naar localStorage als API niet beschikbaar is
            saveTicketToStorage(ticket);
        }
    } catch (error) {
        console.error('Fout bij aanmaken ticket:', error);
        // Fallback naar localStorage
        saveTicketToStorage(ticket);
    }
}

// Sla ticket op in localStorage
function saveTicketToStorage(ticket) {
    try {
        console.log('[TICKET] Saving ticket to storage:', ticket);
        
        // Voeg ticket toe aan lokale array
        tickets.push(ticket);
        
        // Sla op in localStorage
        localStorage.setItem('sollicitatie-tickets', JSON.stringify(tickets));
        
        // Leeg formulier
        document.getElementById('ingame-naam').value = '';
        document.getElementById('discord-id').value = '';
        document.getElementById('geboortedatum').value = '';
        document.getElementById('sollicitatie-nummer').value = '';
        
        // Sluit popup
        sluitSollicitantPopup();
        
        // Update display
        displayTickets();
        showToast('Sollicitatie ticket aangemaakt (lokaal opgeslagen)!');
    } catch (error) {
        console.error('Fout bij opslaan ticket in storage:', error);
        showToast('Fout bij aanmaken ticket', 'error');
    }
}

// Laad tickets
async function loadTickets() {
    try {
        const response = await fetch(`${API}/api/sollicitatie-tickets`);
        if (response.ok) {
            tickets = await response.json();
            displayTickets();
        } else {
            // Fallback naar localStorage als API niet beschikbaar is
            loadTicketsFromStorage();
        }
    } catch (error) {
        console.error('Fout bij laden tickets:', error);
        // Fallback naar localStorage
        loadTicketsFromStorage();
    }
}

// Laad tickets uit localStorage
function loadTicketsFromStorage() {
    try {
        const opgeslagen = localStorage.getItem('sollicitatie-tickets');
        tickets = opgeslagen ? JSON.parse(opgeslagen) : [
            // Test sollicitant voor testing
            {
                id: 'test-1',
                ingameNaam: 'Test Sollicitant',
                discordId: '123456789',
                geboortedatum: '2000-01-01',
                sollicitatieNummer: 'TEST001',
                status: 'wachtend',
                aangemaaktDoor: 'Test User',
                datum: new Date().toISOString()
            }
        ];
        console.log('Tickets geladen uit storage:', tickets);
        displayTickets();
        updateDashboardStats();
    } catch (error) {
        console.error('Fout bij laden tickets uit storage:', error);
        tickets = [
            // Test sollicitant voor testing
            {
                id: 'test-1',
                ingameNaam: 'Test Sollicitant',
                discordId: '123456789',
                geboortedatum: '2000-01-01',
                sollicitatieNummer: 'TEST001',
                status: 'wachtend',
                aangemaaktDoor: 'Test User',
                datum: new Date().toISOString()
            }
        ];
        displayTickets();
        updateDashboardStats();
    }
}

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
        const response = await fetch(`${API}/api/sollicitatie-gesprekken`);
        if (response.ok) {
            gesprekken = await response.json();
            displayGesprekken();
        } else {
            // Fallback naar localStorage als API niet beschikbaar is
            loadGesprekkenFromStorage();
        }
    } catch (error) {
        console.error('Fout bij laden gesprekken:', error);
        // Fallback naar localStorage
        loadGesprekkenFromStorage();
    }
}

// Laad gesprekken uit localStorage
function loadGesprekkenFromStorage() {
    try {
        const opgeslagen = localStorage.getItem('sollicitatie-gesprekken');
        gesprekken = opgeslagen ? JSON.parse(opgeslagen) : [];
        displayGesprekken();
    } catch (error) {
        console.error('Fout bij laden gesprekken uit storage:', error);
        gesprekken = [];
        displayGesprekken();
    }
}

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

            await fetch(`${API}/api/roepnummer/personeel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(personeelData)
            });

            // Voeg toe aan logs
            const logData = {
                actie: 'Sollicitant goedgekeurd',
                details: `${ticket.ingameNaam} (${ticket.discordId}) is goedgekeurd door ${currentUser?.displayName || currentUser?.username || 'Onbekend'} en toegevoegd als 4e klasse met roepnummer`,
                timestamp: new Date().toISOString(),
                gebruiker: currentUser?.displayName || currentUser?.username || 'Onbekend',
                categorie: 'Werving & Selectie'
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
            showToast('Ticket goedgekeurd! Personeel toegevoegd als 4e klasse met roepnummer.');
        } else {
            // Fallback naar localStorage
            keurTicketGoedInStorage(ticketId);
        }
    } catch (error) {
        console.error('Fout bij goedkeuren ticket:', error);
        // Fallback naar localStorage
        keurTicketGoedInStorage(ticketId);
    }
}

// Keur ticket goed in localStorage
function keurTicketGoedInStorage(ticketId) {
    try {
        // Update ticket status
        const ticketIndex = tickets.findIndex(t => t.id === ticketId);
        if (ticketIndex !== -1) {
            tickets[ticketIndex].status = 'goedgekeurd';
            tickets[ticketIndex].goedgekeurdDoor = currentUser?.displayName || currentUser?.username || 'Onbekend';
        }

        // Maak gesprek aan
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

        gesprekken.push(gesprek);

        // Verwijder goedgekeurd ticket uit tickets lijst
        tickets = tickets.filter(t => t.id !== ticketId);

        // Sla op in localStorage
        localStorage.setItem('sollicitatie-tickets', JSON.stringify(tickets));
        localStorage.setItem('sollicitatie-gesprekken', JSON.stringify(gesprekken));

        // Sluit modal en update display
        sluitTicketModal();
        displayTickets();
        displayGesprekken();
        updateDashboardStats();
        showToast('Ticket goedgekeurd en verplaatst naar gesprekken!');
    } catch (error) {
        console.error('Fout bij goedkeuren ticket in storage:', error);
        showToast('Fout bij goedkeuren ticket', 'error');
    }
}

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
            
            // Verwijder ook uit lokale array voor directe update
            const index = tickets.findIndex(t => t.id === ticketId);
            if (index > -1) {
                tickets.splice(index, 1);
                console.log('[TICKET] Ticket uit lokale array verwijderd');
            }
            
            // Update localStorage
            localStorage.setItem('sollicitatie-tickets', JSON.stringify(tickets));
            
            sluitTicketModal();
            displayTickets(); // Directe update zonder reload
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
        // Genereer roepnummer (eenvoudige logica)
        const roepnummer = genereerRoepnummer();

        // Voeg toe aan roepnummer bestand
        const personeel = {
            id: Date.now().toString(),
            naam: gesprek.ingameNaam,
            discordId: gesprek.discordId,
            roepnummer: roepnummer,
            rang: '4e klasse',
            datum: new Date().toISOString(),
            toegevoegdDoor: currentUser?.displayName || currentUser?.username || 'Onbekend'
        };

        await fetch(`${API}/api/personeel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(personeel)
        });

        // Verwijder gesprek
        await fetch(`${API}/api/sollicitatie-gesprekken/${gesprekId}`, {
            method: 'DELETE'
        });

        await loadGesprekken();
        showToast(`${gesprek.ingameNaam} is toegevoegd aan het personeelsbestand met roepnummer ${roepnummer}!`);
    } catch (error) {
        console.error('Fout bij finaliseren gesprek:', error);
        showToast('Fout bij finaliseren gesprek', 'error');
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
