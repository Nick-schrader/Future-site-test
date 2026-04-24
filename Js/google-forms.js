// Google Forms API Integration
// Voor het ophalen van antwoorden uit Google Forms/Sheets

class GoogleFormsAPI {
    constructor() {
        this.apiKey = null;
        this.spreadsheetId = null;
        this.range = 'Form Responses 1!A:Z'; // Standaard range voor alle antwoorden
    }

    // Initialiseer API credentials
    init(apiKey, spreadsheetId) {
        this.apiKey = apiKey;
        this.spreadsheetId = spreadsheetId;
    }

    // Haal antwoorden op uit Google Sheets
    async getResponses() {
        if (!this.apiKey || !this.spreadsheetId) {
            throw new Error('API key en Spreadsheet ID zijn verplicht');
        }

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${this.range}?key=${this.apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.formatResponses(data.values || []);
        } catch (error) {
            console.error('Fout bij ophalen Google Forms antwoorden:', error);
            throw error;
        }
    }

    // Formatteer de antwoorden voor weergave
    formatResponses(values) {
        if (!values || values.length === 0) {
            return [];
        }

        // Eerste rij bevat headers
        const headers = values[0];
        const responses = [];

        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const response = {};
            
            headers.forEach((header, index) => {
                response[header] = row[index] || '';
            });
            
            // Voeg timestamp toe als deze niet bestaat
            if (!response['Timestamp'] && !response['Tijdstempel']) {
                response['Timestamp'] = new Date().toISOString();
            }
            
            responses.push(response);
        }

        return responses;
    }

    // Haal specifieke velden op
    async getSpecificFields(fields) {
        const responses = await this.getResponses();
        return responses.map(response => {
            const filtered = {};
            fields.forEach(field => {
                filtered[field] = response[field] || '';
            });
            return filtered;
        });
    }

    // Haal statistieken op
    async getStatistics() {
        const responses = await this.getResponses();
        const stats = {
            totalResponses: responses.length,
            latestResponse: responses.length > 0 ? responses[responses.length - 1]['Timestamp'] : null,
            responsesByDate: {}
        };

        // Groepeer antwoorden per datum
        responses.forEach(response => {
            const date = new Date(response['Timestamp']).toLocaleDateString('nl-NL');
            stats.responsesByDate[date] = (stats.responsesByDate[date] || 0) + 1;
        });

        return stats;
    }
}

// Globale instantie
window.googleFormsAPI = new GoogleFormsAPI();

// Helper functie voor het opzetten van Google Sheets API
function setupGoogleFormsAPI() {
    // Voorbeeld configuratie - pas deze aan met je eigen data
    const config = {
        apiKey: 'JOUW_GOOGLE_API_KEY', // Vervang met je API key
        spreadsheetId: '1a8NGIPezRQPbFXz_YQUAmZu8VbRgA5hujrhj6GWt0mc', // Uw spreadsheet ID
        range: 'Form Responses 1!A:Z'
    };

    window.googleFormsAPI.init(config.apiKey, config.spreadsheetId);
}

// Export functie voor gebruik in andere modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleFormsAPI, setupGoogleFormsAPI };
}
