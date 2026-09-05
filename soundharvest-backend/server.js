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

// Endpoint που βρίσκει το YouTube Video ID
app.post('/api/download-track', async (req, res) => {
    try {
        const { query } = req.body;

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
        res.json({ videoId: videoId });

    } catch (err) {
        res.status(500).json({ error: "Σφάλμα αναζήτησης: " + err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
