// Werving en Selectie Management
const API = window.location.origin;

// Globale variabelen
let sollicitaties = [];
let currentFilter = '';

// Initialiseer de pagina
document.addEventListener('DOMContentLoaded', function() {
    loadSollicitaties();
    updateStatistics();
});

// Laad alle sollicitaties
async function loadSollicitaties() {
    try {
        const response = await fetch(`${API}/api/werving/sollicitaties`);
        sollicitaties = await response.json();
        displaySollicitaties(sollicitaties);
        updateStatistics();
    } catch (error) {
        console.error('Fout bij laden sollicitaties:', error);
        document.getElementById('sollicitaties-tbody').innerHTML = 
            '<tr><td colspan="6" style="color:#f87171;text-align:center">Fout bij laden data</td></tr>';
    }
}

// Toon sollicitaties in tabel
function displaySollicitaties(data) {
    const tbody = document.getElementById('sollicitaties-tbody');
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:#888;text-align:center">Geen sollicitaties gevonden</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(sollicitatie => {
        const statusBadge = getStatusBadge(sollicitatie.status);
        const aanvraagDatum = new Date(sollicitatie.aanvraagdatum).toLocaleDateString('nl-NL');
        
        return `
            <tr>
                <td>${sollicitatie.naam || '-'}</td>
                <td>${sollicitatie.discord || '-'}</td>
                <td>${statusBadge}</td>
                <td>${aanvraagDatum}</td>
                <td>${sollicitatie.behandelaar || '-'}</td>
                <td>
                    <button class="btn-purple small" onclick="editSollicitatie('${sollicitatie.id}')">Bewerken</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Status badge helper
function getStatusBadge(status) {
    const badges = {
        'open': '<span style="background:#a78bfa;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem">Open</span>',
        'behandeling': '<span style="background:#60a5fa;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem">In behandeling</span>',
        'aangenomen': '<span style="background:#34d399;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem">Aangenomen</span>',
        'afgewezen': '<span style="background:#f87171;color:white;padding:2px 8px;border-radius:4px;font-size:0.8rem">Afgewezen</span>'
    };
    return badges[status] || status;
}

// Update statistieken
function updateStatistics() {
    const stats = {
        open: sollicitaties.filter(s => s.status === 'open').length,
        behandeling: sollicitaties.filter(s => s.status === 'behandeling').length,
        aangenomen: sollicitaties.filter(s => s.status === 'aangenomen').length,
        afgewezen: sollicitaties.filter(s => s.status === 'afgewezen').length
    };

    document.getElementById('open-sollicitaties').textContent = stats.open;
    document.getElementById('behandeling-sollicitaties').textContent = stats.behandeling;
    document.getElementById('aangenomen-sollicitaties').textContent = stats.aangenomen;
    document.getElementById('afgewezen-sollicitaties').textContent = stats.afgewezen;
}

// Filter sollicitaties op status
function filterSollicitaties() {
    const filter = document.getElementById('status-filter').value;
    currentFilter = filter;
    
    const filtered = filter 
        ? sollicitaties.filter(s => s.status === filter)
        : sollicitaties;
    
    displaySollicitaties(filtered);
}

// Laad specifieke status sollicitaties
function loadOpenSollicitaties() {
    document.getElementById('status-filter').value = 'open';
    filterSollicitaties();
}

function loadBehandelingSollicitaties() {
    document.getElementById('status-filter').value = 'behandeling';
    filterSollicitaties();
}

function loadAangenomenSollicitaties() {
    document.getElementById('status-filter').value = 'aangenomen';
    filterSollicitaties();
}

function loadAfgewezenSollicitaties() {
    document.getElementById('status-filter').value = 'afgewezen';
    filterSollicitaties();
}

// Bewerk sollicitatie
function editSollicitatie(id) {
    const solicitatie = sollicitaties.find(s => s.id === id);
    if (!solicitatie) return;

    // Vul modal met data
    const detailsDiv = document.getElementById('sollicitatie-details');
    detailsDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
            <div>
                <strong>Naam:</strong><br>
                ${solicitatie.naam || '-'}
            </div>
            <div>
                <strong>Discord:</strong><br>
                ${solicitatie.discord || '-'}
            </div>
            <div>
                <strong>Email:</strong><br>
                ${solicitatie.email || '-'}
            </div>
            <div>
                <strong>Telefoon:</strong><br>
                ${solicitatie.telefoon || '-'}
            </div>
        </div>
        <div style="margin-top:12px">
            <strong>Motivatie:</strong><br>
            ${solicitatie.motivatie || 'Geen motivatie opgegeven'}
        </div>
        <div style="margin-top:12px">
            <strong>Ervaring:</strong><br>
            ${solicitatie.ervaring || 'Geen ervaring opgegeven'}
        </div>
    `;

    document.getElementById('sollicitatie-status').value = solicitatie.status || 'open';
    document.getElementById('sollicitatie-notities').value = solicitatie.notities || '';

    // Toon modal
    document.getElementById('sollicitatie-modal').classList.remove('hidden');
    
    // Sla huidige ID op voor save functie
    window.currentSollicitatieId = id;
}

// Sluit sollicitatie modal
function closeSollicitatieModal() {
    document.getElementById('sollicitatie-modal').classList.add('hidden');
    window.currentSollicitatieId = null;
}

// Sla sollicitatie wijzigingen op
async function saveSollicitatie() {
    if (!window.currentSollicitatieId) return;

    const status = document.getElementById('sollicitatie-status').value;
    const notities = document.getElementById('sollicitatie-notities').value;

    try {
        const response = await fetch(`${API}/api/werving/sollicitaties/${window.currentSollicitatieId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status,
                notities,
                behandelaar: window.getUser?.()?.username || 'Systeem'
            })
        });

        if (response.ok) {
            showToast('Sollicitatie bijgewerkt!');
            closeSollicitatieModal();
            loadSollicitaties();
        } else {
            showToast('Fout bij bijwerken sollicitatie', 'error');
        }
    } catch (error) {
        console.error('Fout bij opslaan sollicitatie:', error);
        showToast('Fout bij opslaan', 'error');
    }
}

// Nieuwe sollicitatie (placeholder functie)
function nieuweSollicitatie() {
    showToast('Nieuwe sollicitatie functionaliteit wordt ontwikkeld');
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
