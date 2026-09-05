const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { getTracks, getDetails } = require('spotify-url-info')(fetch);

const app = express();
app.use(cors());
app.use(express.json());

// Συνάρτηση για τη δημιουργία ακριβούς YouTube Search Query
function buildExactQuery(title, artist) {
    // Καθαρισμός τίτλου και καλλιτέχνη
    let cleanTitle = title ? title.split('-')[0].trim() : '';
    let cleanArtist = artist ? artist.split(',')[0].trim() : '';

    // Προσθέτουμε τη λέξη "Audio" ή "Official" για να βρει το επίσημο τραγούδι
    return `${cleanArtist} ${cleanTitle} Official Audio`;
}

// 1. Endpoint για ανάλυση Playlist/Track
app.post('/api/parse', async (req, res) => {
    try {
        const { spotifyUrl } = req.body;
        if (!spotifyUrl) return res.status(400).json({ error: "Missing URL" });

        let tracksData = [];

        try {
            const fetchedTracks = await getTracks(spotifyUrl);
            tracksData = fetchedTracks.map(t => {
                const artistName = t.artists ? t.artists.map(a => a.name).join(', ') : (t.artist || '');
                return {
                    title: t.name,
                    artist: artistName,
                    // Δημιουργία ακριβούς query για το YouTube
                    query: buildExactQuery(t.name, artistName)
                };
            });
        } catch (e) {
            const details = await getDetails(spotifyUrl);
            if (details && details.preview) {
                tracksData = [{
                    title: details.preview.title,
                    artist: details.preview.artist,
                    query: buildExactQuery(details.preview.title, details.preview.artist)
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

// 2. Direct Download Link Endpoint
app.post('/api/get-download-link', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: "Missing query" });

        // Αναζήτηση στο YouTube με το βελτιωμένο query
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const htmlRes = await fetch(searchUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8' // Προτίμηση ελληνικών αποτελεσμάτων
            }
        });
        const html = await htmlRes.text();
        const videoIdMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);

        if (!videoIdMatch) {
            return res.status(404).json({ error: "Δεν βρέθηκε το βίντεο στο YouTube" });
        }

        const videoId = videoIdMatch[1];
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Μετατροπή μέσω Loader.to API
        const convertRes = await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(youtubeUrl)}`);
        const convertData = await convertRes.json();

        if (convertData && convertData.id) {
            let downloadUrl = null;
            for (let i = 0; i < 12; i++) {
                await new Promise(r => setTimeout(r, 1500));
                const progressRes = await fetch(`https://loader.to/ajax/progress.php?id=${convertData.id}`);
                const progressData = await progressRes.json();
                
                if (progressData.download_url) {
                    downloadUrl = progressData.download_url;
                    break;
                }
            }

            if (downloadUrl) {
                return res.json({ downloadUrl });
            }
        }

        return res.status(500).json({ error: "Η μετατροπή απέτυχε." });

    } catch (err) {
        res.status(500).json({ error: "Download error: " + err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
