const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { getTracks, getDetails } = require('spotify-url-info')(fetch);

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint για ανάλυση Playlist ή Single Track
app.post('/api/parse', async (req, res) => {
    try {
        const { spotifyUrl } = req.body;
        if (!spotifyUrl) return res.status(400).json({ error: "Missing URL" });

        let tracksData = [];

        try {
            const fetchedTracks = await getTracks(spotifyUrl);
            tracksData = fetchedTracks.map(t => ({
                title: t.name,
                artist: t.artists ? t.artists.map(a => a.name).join(', ') : (t.artist || ''),
                query: `${t.name} ${t.artists ? t.artists[0].name : ''}`
            }));
        } catch (e) {
            const details = await getDetails(spotifyUrl);
            if (details && details.preview) {
                tracksData = [{
                    title: details.preview.title,
                    artist: details.preview.artist,
                    query: `${details.preview.title} ${details.preview.artist}`
                }];
            }
        }

        if (!tracksData || tracksData.length === 0) {
            return res.status(404).json({ error: "Δεν βρέθηκαν τραγούδια. Βεβαιώσου ότι το link είναι δημόσιο (Public)." });
        }

        res.json({ tracks: tracksData });

    } catch (err) {
        res.status(500).json({ error: "Αποτυχία ανάγνωσης Spotify link: " + err.message });
    }
});

// Endpoint για άμεσο κατέβασμα MP3
app.post('/api/download-track', async (req, res) => {
    try {
        const { query } = req.body;
        
        // 1. Βρίσκουμε το πρώτο βίντεο στο YouTube για το τραγούδι
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const htmlRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const html = await htmlRes.text();
        const videoIdMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);

        if (!videoIdMatch) {
            return res.status(404).json({ error: "Δεν βρέθηκε το τραγούδι στο YouTube." });
        }

        const youtubeUrl = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;

        // 2. Ζητάμε από το Cobalt API το άμεσο σύνδεσμο MP3
        const cobaltRes = await fetch("https://api.cobalt.tools/", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: youtubeUrl,
                downloadMode: "audio",
                audioFormat: "mp3"
            })
        });

        const cobaltData = await cobaltRes.json();
        
        if (cobaltData && cobaltData.url) {
            return res.json({ downloadUrl: cobaltData.url });
        }

        // Αν το Cobalt είναι απασχολημένο/down
        return res.status(503).json({ error: "Ο διακομιστής λήψης είναι προσωρινά απασχολημένος. Δοκίμασε ξανά σε λίγο." });

    } catch (err) {
        res.status(500).json({ error: "Σφάλμα κατά τη λήψη: " + err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
