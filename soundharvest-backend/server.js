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
            // Προσπάθεια ανάκτησης όλων των κομματιών της Playlist
            const fetchedTracks = await getTracks(spotifyUrl);
            tracksData = fetchedTracks.map(t => ({
                title: t.name,
                artist: t.artists ? t.artists.map(a => a.name).join(', ') : (t.artist || ''),
                query: `${t.name} ${t.artists ? t.artists[0].name : ''}`
            }));
        } catch (e) {
            // Αν είναι μεμονωμένο τραγούδι (Track)
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
            return res.status(404).json({ error: "Δεν βρέθηκαν τραγούδια. Βεβαιώσου ότι το link είναι σωστό." });
        }

        res.json({ tracks: tracksData });

    } catch (err) {
        res.status(500).json({ error: "Αποτυχία ανάγνωσης Spotify link: " + err.message });
    }
});

// Endpoint για λήψη MP3 link
app.post('/api/download-track', async (req, res) => {
    try {
        const { query } = req.body;
        const searchQuery = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

        const cobaltRes = await fetch("https://api.cobalt.tools/", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: searchQuery,
                downloadMode: "audio",
                audioFormat: "mp3"
            })
        });

        const cobaltData = await cobaltRes.json();
        
        if (cobaltData.url) {
            res.json({ downloadUrl: cobaltData.url });
        } else {
            res.json({ downloadUrl: searchQuery });
        }
    } catch (err) {
        res.status(500).json({ error: "Download failed" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
