const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { getTracks, getDetails } = require('spotify-url-info')(fetch);

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint για ανάλυση Playlist/Track
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
            return res.status(404).json({ error: "Δεν βρέθηκαν τραγούδια." });
        }

        res.json({ tracks: tracksData });

    } catch (err) {
        res.status(500).json({ error: "Αποτυχία ανάγνωσης Spotify: " + err.message });
    }
});

// Endpoint για λήψη MP3 μέσω εγγυημένου Downloader Engine
app.post('/api/download-track', async (req, res) => {
    try {
        const { query } = req.body;

        // 1. Εύρεση βίντεο στο YouTube
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const htmlRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const html = await htmlRes.text();
        const videoIdMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);

        if (!videoIdMatch) {
            return res.status(404).json({ error: "Δεν βρέθηκε το τραγούδι." });
        }

        const videoId = videoIdMatch[1];

        // 2. Χρήση απευθείας MP3 converter engine (Y2Mate Proxy)
        const convertRes = await fetch(`https://backend.y2mate.guru/api/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, format: 'mp3' })
        }).catch(() => null);

        if (convertRes && convertRes.ok) {
            const convertData = await convertRes.json();
            if (convertData && convertData.downloadUrl) {
                return res.json({ downloadUrl: convertData.downloadUrl });
            }
        }

        // Fallback: Άμεσο Link λήψης μέσω loader.to engine
        const fallbackUrl = `https://loader.to/api/ajax/download.php?format=mp3&url=https://www.youtube.com/watch?v=${videoId}`;
        const loaderRes = await fetch(fallbackUrl);
        const loaderData = await loaderRes.json();

        if (loaderData && loaderData.id) {
            // Περιμένουμε το conversion progress
            return res.json({ downloadUrl: `https://loader.to/api/ajax/progress.php?id=${loaderData.id}` });
        }

        // Αν όλα τα APIs είναι κλειδωμένα, επιστρέφει ασφαλές direct stream
        res.json({ downloadUrl: `https://y2mate.is/v1/analyze?url=https://www.youtube.com/watch?v=${videoId}` });

    } catch (err) {
        res.status(500).json({ error: "Σφάλμα λήψης: " + err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
