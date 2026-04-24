// Google Forms Functionaliteit voor Werving en Selectie pagina
let googleFormsData = [];
let filteredGoogleFormsData = [];

// Initialiseer Google Forms API configuratie
function initGoogleFormsAPI() {
    const apiKey = localStorage.getItem('google_api_key');
    const spreadsheetId = localStorage.getItem('spreadsheet_id');
    
    if (apiKey && spreadsheetId) {
        window.googleFormsAPI.init(apiKey, spreadsheetId);
        document.getElementById('google-api-key').value = apiKey;
        document.getElementById('spreadsheet-id').value = spreadsheetId;
        loadGoogleFormsData();
    }
}

// Sla Google Forms configuratie op
function saveGoogleFormsConfig() {
    const apiKey = document.getElementById('google-api-key').value.trim();
    const spreadsheetId = document.getElementById('spreadsheet-id').value.trim();
    
    if (!apiKey || !spreadsheetId) {
        showToast('Vul alle velden in', 'error');
        return;
    }
    
    localStorage.setItem('google_api_key', apiKey);
    localStorage.setItem('spreadsheet_id', spreadsheetId);
    
    window.googleFormsAPI.init(apiKey, spreadsheetId);
    
    showToast('Google Forms configuratie opgeslagen!');
    loadGoogleFormsData();
}

// Laad Google Forms data
async function loadGoogleFormsData() {
    try {
        if (!window.googleFormsAPI.apiKey || !window.googleFormsAPI.spreadsheetId) {
            showToast('Configureer eerst de API key', 'error');
            return;
        }
        
        showToast('Google Forms data laden...');
        const responses = await window.googleFormsAPI.getResponses();
        googleFormsData = responses;
        filteredGoogleFormsData = responses;
        
        displayGoogleFormsResponses(responses);
        updateGoogleFormsStatistics();
        showToast(`${responses.length} sollicitaties via Google Forms geladen!`);
    } catch (error) {
        console.error('Fout bij laden Google Forms data:', error);
        showToast('Fout bij laden data: ' + error.message, 'error');
        displayGoogleFormsError(error.message);
    }
}

// Toon Google Forms antwoorden in tabel
function displayGoogleFormsResponses(data) {
    const tbody = document.getElementById('google-forms-tbody');
    const thead = document.getElementById('google-forms-headers');
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="color:#888;text-align:center">Geen sollicitaties gevonden</td></tr>';
        thead.innerHTML = '<tr><th colspan="7">Geen data</th></tr>';
        return;
    }
    
    // Haal headers uit eerste response
    const headers = Object.keys(data[0]);
    thead.innerHTML = headers.map(header => 
        `<th style="cursor:pointer" onclick="sortGoogleFormsTable('${header}')">${header} ↕</th>`
    ).join('');
    
    // Toon data met sollicitatie-specifieke styling
    tbody.innerHTML = data.map((response, index) => {
        const timestamp = response['Timestamp'] || response['Tijdstempel'] || '';
        const formattedDate = timestamp ? new Date(timestamp).toLocaleString('nl-NL') : '';
        const name = response['Naam'] || response['Name'] || response['name'] || 'Onbekend';
        
        return `
            <tr style="cursor:pointer" onclick="viewGoogleFormsResponse(${index})">
                ${headers.map(header => {
                    let value = response[header] || '';
                    
                    // Formatteer timestamp
                    if (header.toLowerCase().includes('timestamp') || header.toLowerCase().includes('tijdstempel')) {
                        value = formattedDate;
                    }
                    
                    // Highlight naam
                    if ((header.toLowerCase().includes('naam') || header.toLowerCase().includes('name')) && value) {
                        value = `<strong>${value}</strong>`;
                    }
                    
                    // Truncate lange tekst
                    if (value.length > 80) {
                        value = `<span title="${value}">${value.substring(0, 80)}...</span>`;
                    }
                    
                    return `<td>${value}</td>`;
                }).join('')}
            </tr>
        `;
    }).join('');
}

// Update Google Forms statistieken
function updateGoogleFormsStatistics() {
    const totalElement = document.getElementById('google-forms-total');
    const todayElement = document.getElementById('google-forms-today');
    const weekElement = document.getElementById('google-forms-week');
    
    if (totalElement) totalElement.textContent = googleFormsData.length;
    
    // Antwoorden vandaag
    const today = new Date().toDateString();
    const todayCount = googleFormsData.filter(response => {
        const timestamp = response['Timestamp'] || response['Tijdstempel'];
        return timestamp && new Date(timestamp).toDateString() === today;
    }).length;
    
    if (todayElement) todayElement.textContent = todayCount;
    
    // Antwoorden deze week
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekCount = googleFormsData.filter(response => {
        const timestamp = response['Timestamp'] || response['Tijdstempel'];
        return timestamp && new Date(timestamp) >= weekAgo;
    }).length;
    
    if (weekElement) weekElement.textContent = weekCount;
}

// Filter Google Forms antwoorden
function filterGoogleForms() {
    const searchTerm = document.getElementById('google-forms-search').value.toLowerCase();
    const dateFilter = document.getElementById('google-forms-date-filter').value;
    
    filteredGoogleFormsData = googleFormsData.filter(response => {
        // Zoekfilter
        const matchesSearch = !searchTerm || Object.values(response).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
        
        // Datumfilter
        const timestamp = response['Timestamp'] || response['Tijdstempel'];
        const responseDate = timestamp ? new Date(timestamp) : null;
        
        let matchesDate = true;
        if (dateFilter && responseDate) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            switch (dateFilter) {
                case 'today':
                    matchesDate = responseDate.toDateString() === today.toDateString();
                    break;
                case 'week':
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    matchesDate = responseDate >= weekAgo;
                    break;
                case 'month':
                    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                    matchesDate = responseDate >= monthAgo;
                    break;
            }
        }
        
        return matchesSearch && matchesDate;
    });
    
    displayGoogleFormsResponses(filteredGoogleFormsData);
}

// Sorteer Google Forms tabel
let googleFormsSortDirection = {};
function sortGoogleFormsTable(column) {
    const direction = googleFormsSortDirection[column] === 'asc' ? 'desc' : 'asc';
    googleFormsSortDirection[column] = direction;
    
    filteredGoogleFormsData.sort((a, b) => {
        const aVal = a[column] || '';
        const bVal = b[column] || '';
        
        if (direction === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    displayGoogleFormsResponses(filteredGoogleFormsData);
}

// Bekijk specifieke Google Forms response
function viewGoogleFormsResponse(index) {
    const response = filteredGoogleFormsData[index];
    if (!response) return;
    
    // Maak een modal met alle details
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    const headers = Object.keys(response);
    const content = headers.map(header => {
        const value = response[header] || '';
        const timestamp = header.toLowerCase().includes('timestamp') || header.toLowerCase().includes('tijdstempel');
        const formattedValue = timestamp && value ? new Date(value).toLocaleString('nl-NL') : value;
        
        return `
            <div style="margin-bottom:12px">
                <strong>${header}:</strong><br>
                ${formattedValue || '-'}
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div class="modal-card" style="max-width:600px;max-height:70vh;overflow-y:auto">
            <h2>📋 Sollicitatie Details</h2>
            <div style="margin-bottom:16px">
                <button class="btn-purple" onclick="convertToSollicitatie(${index})">+ Converteer naar Sollicitatie</button>
                <button class="btn-ghost" onclick="exportResponse(${index})">📥 Export</button>
            </div>
            ${content}
            <div style="display:flex;gap:10px;margin-top:16px">
                <button class="btn-purple" style="flex:1" onclick="closeGoogleFormsModal()">Sluiten</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Sla huidige response index op
    window.currentGoogleFormsResponseIndex = index;
}

// Converteer Google Forms response naar sollicitatie
function convertToSollicitatie(index) {
    const response = filteredGoogleFormsData[index];
    if (!response) return;
    
    // Haal relevante data uit de response
    const name = response['Naam'] || response['Name'] || response['name'] || '';
    const email = response['Email'] || response['email'] || '';
    const discord = response['Discord'] || response['discord'] || '';
    const motivation = response['Motivatie'] || response['Motivation'] || response['motivatie'] || '';
    const experience = response['Ervaring'] || response['Experience'] || response['ervaring'] || '';
    
    // Vul de sollicitatie modal met deze data
    const detailsDiv = document.getElementById('sollicitatie-details');
    if (detailsDiv) {
        detailsDiv.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
                <div>
                    <strong>Naam:</strong><br>
                    ${name || '-'}
                </div>
                <div>
                    <strong>Email:</strong><br>
                    ${email || '-'}
                </div>
                <div>
                    <strong>Discord:</strong><br>
                    ${discord || '-'}
                </div>
                <div>
                    <strong>Bron:</strong><br>
                    Google Forms
                </div>
            </div>
            <div style="margin-top:12px">
                <strong>Motivatie:</strong><br>
                ${motivation || 'Geen motivatie opgegeven'}
            </div>
            <div style="margin-top:12px">
                <strong>Ervaring:</strong><br>
                ${experience || 'Geen ervaring opgegeven'}
            </div>
        `;
    }
    
    // Open de sollicitatie modal
    const sollicitatieModal = document.getElementById('sollicitatie-modal');
    if (sollicitatieModal) {
        sollicitatieModal.classList.remove('hidden');
    }
    
    // Sluit Google Forms modal
    closeGoogleFormsModal();
    
    showToast('Sollicitatie geconverteerd uit Google Forms!');
}

// Export Google Forms naar CSV
function exportGoogleFormsToCSV() {
    if (filteredGoogleFormsData.length === 0) {
        showToast('Geen data om te exporteren', 'error');
        return;
    }
    
    const headers = Object.keys(filteredGoogleFormsData[0]);
    const csvContent = [
        headers.join(','),
        ...filteredGoogleFormsData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `google-forms-sollicitaties-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('Google Forms data geëxporteerd!');
}

// Export enkele response
function exportResponse(index) {
    const response = filteredGoogleFormsData[index];
    if (!response) return;
    
    const headers = Object.keys(response);
    const csvContent = [
        headers.join(','),
        headers.map(header => `"${response[header] || ''}"`).join(',')
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sollicitatie-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('Sollicitatie geëxporteerd!');
}

// Toon foutmelding
function displayGoogleFormsError(message) {
    const tbody = document.getElementById('google-forms-tbody');
    const thead = document.getElementById('google-forms-headers');
    
    thead.innerHTML = '<tr><th colspan="7">Fout</th></tr>';
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="color:#f87171;text-align:center;padding:20px">
                <h4>❌ Fout bij laden Google Forms</h4>
                <p style="color:#666;margin:10px 0">${message}</p>
                <button class="btn-purple" onclick="loadGoogleFormsData()">Opnieuw proberen</button>
                <button class="btn-ghost" onclick="showGoogleFormsSetup()">Setup Gids</button>
            </td>
        </tr>
    `;
}

// Toon setup modal
function showGoogleFormsSetup() {
    document.getElementById('google-forms-setup-modal').classList.remove('hidden');
}

// Sluit setup modal
function closeGoogleFormsSetup() {
    document.getElementById('google-forms-setup-modal').classList.add('hidden');
}

// Sluit Google Forms modal
function closeGoogleFormsModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
    window.currentGoogleFormsResponseIndex = null;
}

// Toast helper (hergebruik bestaande)
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

// Initialiseer bij pagina laden
document.addEventListener('DOMContentLoaded', function() {
    initGoogleFormsAPI();
});
