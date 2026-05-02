// Blacklist Management
const API = window.location.origin;

// Globale variabelen
let blacklistData = [];
let currentFilter = '';
let currentSearch = '';

// Initialiseer de pagina
document.addEventListener('DOMContentLoaded', function() {
    loadBlacklist();
});

// Laad blacklist data
async function loadBlacklist() {
    try {
        const response = await fetch(`${API}/api/blacklist`);
        const data = await response.json();
        console.log('Blacklist data geladen:', data);
        blacklistData = data;
        displayBlacklist(blacklistData);
    } catch (error) {
        console.error('Fout bij laden blacklist:', error);
        document.getElementById('blacklist-tbody').innerHTML = 
            '<tr><td colspan="5" style="color:#f87171;text-align:center">Fout bij laden data</td></tr>';
    }
}

// Toon blacklist in tabel
function displayBlacklist(data) {
    const tbody = document.getElementById('blacklist-tbody');
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#888;text-align:center">Geen geblackliste personen gevonden</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(item => {
        const blacklistDatum = item.datum ? new Date(item.datum).toLocaleDateString('nl-NL') : '-';
        
        return `
            <tr>
                <td>${item.naam || '-'}</td>
                <td>${item.discord_id || '-'}</td>
                <td>${item.reden ? getRedenBadge(item.reden) : item.reden || '-'}</td>
                <td>${item.beschrijving || '-'}</td>
                <td>${blacklistDatum}</td>
                <td>${item.blacklisted_by || '-'}</td>
                <td>
                    <button class="btn-ghost" onclick="verwijderUitBlacklist('${item.id}')" style="padding:4px 8px;font-size:0.8rem;background:#dc2626">🗑️ Verwijder</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Reden badge helper
function getRedenBadge(reden) {
    const badges = {
        'misdraging': '<span style="background:#f87171;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem">Misdraging</span>',
        'inactiviteit': '<span style="background:#f59e0b;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem">Inactiviteit</span>',
        'regels': '<span style="background:#8b5cf6;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem">Regel overtreding</span>',
        'overig': '<span style="background:#6b7280;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem">Overig</span>'
    };
    return badges[reden] || reden;
}


// Filter blacklist
function filterBlacklist() {
    const filter = document.getElementById('blacklist-filter').value;
    const search = document.getElementById('blacklist-zoek').value.toLowerCase();
    
    let filtered = blacklistData;
    
    // Filter op reden
    if (filter) {
        filtered = filtered.filter(item => item.reden === filter);
    }
    
    // Filter op zoekterm
    if (search) {
        filtered = filtered.filter(item => 
            (item.naam && item.naam.toLowerCase().includes(search)) ||
            (item.discord_id && item.discord_id.toLowerCase().includes(search)) ||
            (item.beschrijving && item.beschrijving.toLowerCase().includes(search))
        );
    }
    
    displayBlacklist(filtered);
}

// Toevoegen aan blacklist modal
function toevoegenAanBlacklist() {
    document.getElementById('blacklist-toevoegen-modal').classList.remove('hidden');
}

// Sluit toevoegen modal
function closeBlacklistToevoegenModal() {
    document.getElementById('blacklist-toevoegen-modal').classList.add('hidden');
    // Reset form
    document.getElementById('blacklist-discord-id').value = '';
    document.getElementById('blacklist-naam').value = '';
    document.getElementById('blacklist-roepnummer').value = '';
    document.getElementById('blacklist-reden').value = '';
    document.getElementById('blacklist-beschrijving').value = '';
}

// Sla nieuwe blacklist entry op
async function saveBlacklistToevoegen() {
    const discordId = document.getElementById('blacklist-discord-id').value.trim();
    const naam = document.getElementById('blacklist-naam').value.trim();
    const roepnummer = document.getElementById('blacklist-roepnummer').value.trim();
    const reden = document.getElementById('blacklist-reden').value;
    const beschrijving = document.getElementById('blacklist-beschrijving').value.trim();

    if (!discordId || !naam || !reden || !beschrijving) {
        showToast('Vul alle verplichte velden in', 'error');
        return;
    }

    try {
        const response = await fetch(`${API}/api/blacklist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                discord_id: discordId,
                naam,
                roepnummer,
                reden,
                beschrijving,
                blacklisted_by: window.getUser?.()?.username || 'Systeem'
            })
        });

        if (response.ok) {
            showToast('Persoon toegevoegd aan blacklist!');
            closeBlacklistToevoegenModal();
            loadBlacklist();
        } else {
            const errorData = await response.json();
            showToast(`Fout bij toevoegen: ${errorData.error || 'Onbekende fout'}`, 'error');
        }
    } catch (error) {
        console.error('Fout bij toevoegen aan blacklist:', error);
        
        // Fallback naar localStorage als API faalt
        try {
            const blacklist = JSON.parse(localStorage.getItem('blacklist') || '[]');
            const newItem = {
                id: Date.now().toString(),
                discord_id: discordId,
                naam,
                roepnummer,
                reden,
                beschrijving,
                blacklisted_by: window.getUser?.()?.username || 'Systeem',
                datum: new Date().toISOString()
            };
            
            blacklist.push(newItem);
            localStorage.setItem('blacklist', JSON.stringify(blacklist));
            
            showToast('Persoon toegevoegd aan blacklist (lokaal opgeslagen)!');
            closeBlacklistToevoegenModal();
            loadBlacklist();
        } catch (localError) {
            console.error('Fout bij lokale opslag:', localError);
            showToast('Fout bij opslaan - probeer het opnieuw', 'error');
        }
    }
}

// Bewerk blacklist item
function editBlacklist(id) {
    const item = blacklistData.find(b => b.id === id);
    if (!item) return;

    // Vul modal met data
    const detailsDiv = document.getElementById('blacklist-details');
    detailsDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
            <div>
                <strong>Naam:</strong><br>
                ${item.naam || '-'}
            </div>
            <div>
                <strong>Discord ID:</strong><br>
                ${item.discord_id || '-'}
            </div>
            <div>
                <strong>Roepnummer:</strong><br>
                ${item.roepnummer || '-'}
            </div>
            <div>
                <strong>Blacklist Datum:</strong><br>
                ${new Date(item.blacklist_datum).toLocaleDateString('nl-NL')}
            </div>
        </div>
        <div style="margin-top:12px">
            <strong>Blacklisted by:</strong><br>
            ${item.blacklisted_by || '-'}
        </div>
    `;

    document.getElementById('blacklist-edit-reden').value = item.reden || '';
    document.getElementById('blacklist-edit-beschrijving').value = item.beschrijving || '';
    document.getElementById('blacklist-edit-notities').value = item.notities || '';

    // Toon modal
    document.getElementById('blacklist-bewerken-modal').classList.remove('hidden');
    
    // Sla huidige ID op
    window.currentBlacklistId = id;
}

// Sluit bewerken modal
function closeBlacklistBewerkenModal() {
    document.getElementById('blacklist-bewerken-modal').classList.add('hidden');
    window.currentBlacklistId = null;
}

// Sla blacklist wijzigingen op
async function saveBlacklistBewerken() {
    if (!window.currentBlacklistId) return;

    const reden = document.getElementById('blacklist-edit-reden').value;
    const beschrijving = document.getElementById('blacklist-edit-beschrijving').value;
    const notities = document.getElementById('blacklist-edit-notities').value;

    try {
        const response = await fetch(`${API}/api/blacklist/${window.currentBlacklistId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reden,
                beschrijving,
                notities
            })
        });

        if (response.ok) {
            showToast('Blacklist item bijgewerkt!');
            closeBlacklistBewerkenModal();
            loadBlacklist();
        } else {
            showToast('Fout bij bijwerken', 'error');
        }
    } catch (error) {
        console.error('Fout bij bijwerken blacklist:', error);
        showToast('Fout bij opslaan', 'error');
    }
}

// Verwijder uit blacklist
async function verwijderUitBlacklist(id) {
    console.log('Verwijder blacklist item met ID:', id);
    
    if (!confirm('Weet je zeker dat je deze persoon wilt verwijderen uit de blacklist?')) {
        return;
    }

    try {
        console.log('Sending DELETE request to:', `${API}/api/blacklist/${id}`);
        const response = await fetch(`${API}/api/blacklist/${id}`, {
            method: 'DELETE'
        });

        console.log('DELETE response status:', response.status);
        
        if (response.ok) {
            showToast('Persoon verwijderd uit blacklist!');
            loadBlacklist();
            
            // Ververs logs om nieuwe blacklist verwijdering log te tonen
            console.log('[BLACKLIST FRONTEND] Proberen logs te verversen...');
            console.log('[BLACKLIST FRONTEND] loadLogs functie beschikbaar:', typeof loadLogs);
            
            if (typeof loadLogs === 'function') {
                console.log('[BLACKLIST FRONTEND] loadLogs() aanroepen na 1 seconde vertraging...');
                setTimeout(() => {
                    console.log('[BLACKLIST FRONTEND] loadLogs() nu aanroepen');
                    loadLogs();
                }, 1000);
            } else {
                console.log('[BLACKLIST FRONTEND] loadLogs functie niet beschikbaar!');
            }
        } else {
            const errorData = await response.json();
            console.log('DELETE error response:', errorData);
            showToast(`Fout bij verwijderen: ${errorData.error || 'Onbekende fout'}`, 'error');
        }
    } catch (error) {
        console.error('Fout bij verwijderen blacklist:', error);
        
        // Fallback naar localStorage
        try {
            const blacklist = JSON.parse(localStorage.getItem('blacklist') || '[]');
            const updatedBlacklist = blacklist.filter(item => item.id !== id);
            localStorage.setItem('blacklist', JSON.stringify(updatedBlacklist));
            
            showToast('Persoon verwijderd uit blacklist (lokaal opgeslagen)!');
            loadBlacklist();
        } catch (localError) {
            console.error('Fout bij lokale opslag:', localError);
            showToast('Fout bij verwijderen - probeer het opnieuw', 'error');
        }
    }
}


// Toast helper
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    
    toastMsg.textContent = message;
    toast.classList.remove('hidden');
    
    if (type === 'error') {
        toast.style.background = '#f87171';
    } else {
        toast.style.background = '#34d399';
    }
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Hide toast
function hideToast() {
    document.getElementById('toast').classList.add('hidden');
}
