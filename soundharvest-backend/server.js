const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { getTracks, getDetails } = require('spotify-url-info')(fetch);

const app = express();
app.use(cors());
app.use(express.json());

// 1. Endpoint για ανάλυση Playlist/Track
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

// 2. Direct Stream/Download Endpoint (Στέλνει το αρχείο απευθείας στον χρήστη)
app.get('/api/download-direct', async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) return res.status(400).send("Missing query");

        // Αναζήτηση στο YouTube
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const htmlRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const html = await htmlRes.text();
        const videoIdMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);

        if (!videoIdMatch) {
            return res.status(404).send("Track not found");
        }

        const videoId = videoIdMatch[1];
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Χρήση αξιόπιστου backend API conversion engine
        const apiUrl = `https://api.vevioz.com/api/button/mp3/${videoId}`;
        const apiRes = await fetch(apiUrl);
        const apiHtml = await apiRes.text();

        // Εξαγωγή του απευθείας MP3 Link
        const downloadLinkMatch = apiHtml.match(/href="(https:\/\/[^"]+\.mp3[^"]*)"/i) || 
                                  apiHtml.match(/href="(https:\/\/download[^"]+)"/i);

        if (downloadLinkMatch && downloadLinkMatch[1]) {
            // Κάνει redirect απευθείας στο MP3 αρχείο για αυτόματη λήψη
            return res.redirect(downloadLinkMatch[1]);
        }

        // Fallback Direct Engine
        res.redirect(`https://api.vibe.download/dl?url=${encodeURIComponent(youtubeUrl)}`);

    } catch (err) {
        res.status(500).send("Download Error: " + err.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
