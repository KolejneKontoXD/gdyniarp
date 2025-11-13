// Plik: netlify-functions/discord-auth.js
const fetch = require('node-fetch');

// 1. ZMIENNE ŚRODOWISKOWE - KLUCZE API
// Netlify automatycznie załaduje te zmienne z Twojego panelu.
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// 2. ADRESY URL
// Adres, na który Discord odeśle użytkownika po autoryzacji (MUSI pasować do ustawień Discord App)
// Adres ten zostanie zbudowany dynamicznie przez Netlify.
const REDIRECT_URI_BASE = process.env.URL; 
const AUTH_URI = `${REDIRECT_URI_BASE}/.netlify/functions/discord-auth`;
const PANEL_URI = `${REDIRECT_URI_BASE}/admin-panel.html`; // DOCELOWY PANEL

// Lista ID Użytkowników Discorda, którzy mają dostęp
// Wklej tutaj ID konta @oskubny, @Qułek_PL, @V-L galejza itp.
const AUTHORIZED_USER_IDS = [
    "1434253936600289302", // Przykład ID Discorda (Zmień!)
    "987654321098765432"  // Dodaj kolejne ID administracji
];


// ---------- Główna funkcja Netlify Function ----------

exports.handler = async (event, context) => {
    // 1. Użytkownik kliknął 'Zaloguj' (Brak kodu w URL)
    if (!event.queryStringParameters.code) {
        // Generujemy URL do autoryzacji Discorda
        const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(AUTH_URI)}&response_type=code&scope=identify`;
        
        return {
            statusCode: 302,
            headers: {
                Location: discordAuthUrl,
                'Cache-Control': 'no-cache',
            },
            body: '',
        };
    }

    // 2. Użytkownik wrócił z Discorda (Jest 'code' lub 'error' w URL)
    const { code, error } = event.queryStringParameters;
    
    // Obsługa, gdy użytkownik anulował logowanie
    if (error === 'access_denied') {
        return {
            statusCode: 302,
            headers: {
                Location: `/login.html?error=denied`,
                'Cache-Control': 'no-cache',
            },
            body: '',
        };
    }

    // Wymiana kodu na token dostępu (Token Exchange)
    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: AUTH_URI,
                scope: 'identify',
            }).toString(),
        });
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            throw new Error('Nie udało się uzyskać tokenu dostępu.');
        }

        // Pobranie danych użytkownika (ID)
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();
        const userId = userData.id;

        // WERYFIKACJA AUTORYZACJI
        if (AUTHORIZED_USER_IDS.includes(userId)) {
            // Sukces: Użytkownik jest administratorem. Przekierowujemy do panelu.
            return {
                statusCode: 302,
                headers: {
                    Location: PANEL_URI,
                    'Cache-Control': 'no-cache',
                },
                body: '',
            };
        } else {
            // Błąd: Użytkownik nie jest na liście.
            return {
                statusCode: 302,
                headers: {
                    Location: `/login.html?error=unauthorized`,
                    'Cache-Control': 'no-cache',
                },
                body: '',
            };
        }

    } catch (error) {
        console.error('Błąd w procesie autoryzacji:', error);
        return {
            statusCode: 302,
            headers: {
                Location: `/login.html?error=internal`,
                'Cache-Control': 'no-cache',
            },
            body: '',
        };
    }
};
