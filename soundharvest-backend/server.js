const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint για ανάλυση Playlist/Track
app.post('/api/parse', async (req, res) => {
    try {
        const { spotifyUrl } = req.body;
        if (!spotifyUrl) return res.status(400).json({ error: "Missing URL" });

        let cleanUrl = spotifyUrl.split('?')[0];
        let embedUrl = cleanUrl.replace("open.spotify.com/", "open.spotify.com/embed/");

        const embedRes = await fetch(embedUrl);
        const embedHtml = await embedRes.text();

        const tracks = [];
        const regex = /"name":"(.*?)".*?"artists":\[{"name":"(.*?)"/g;
        let match;

        while ((match = regex.exec(embedHtml)) !== null) {
            tracks.push({
                title: match[1],
                artist: match[2],
                query: `${match[1]} ${match[2]}`
            });
        }

        if (tracks.length === 0) {
            return res.status(404).json({ error: "Δεν βρέθηκαν τραγούδια. Βεβαιώσου ότι η playlist είναι Public." });
        }

        // Επιστρέφουμε τη λίστα των τραγουδιών στο Frontend
        res.json({ tracks });

    } catch (err) {
        res.status(500).json({ error: "Server Error: " + err.message });
    }
});

// Endpoint για λήψη MP3 link για κάθε τραγούδι
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
            // Fallback αν το Cobalt είναι απασχολημένο: Στέλνει τον χρήστη στην αναζήτηση YouTube
            res.json({ downloadUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` });
        }
    } catch (err) {
        res.status(500).json({ error: "Download failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));