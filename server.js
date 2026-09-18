const express = require('express');
const app = express();
const PORT = 3000;

let map = {};

function randomGenerator() {
    const contianer = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let ans = "";

    for (let i = 0; i < 6; i++){
        ans += contianer[Math.floor(Math.random() * 62)];
    }

    return ans;
}

// Middleware: Tells Express to parse incoming JSON data from requests
app.use(express.json());

// A simple GET route to verify the server is responding
app.get('/', (req, res) => {
    res.json({ message: "URL Shortener API is up and running!" });
});

app.post('/shorten', (req, res) => {
    const urlToShorten = req.body.longUrl;

    let shortCode = randomGenerator();
    while (Object.hasOwn(map, shortCode)){
        shortCode = randomGenerator();
    }

    map[shortCode] = urlToShorten;
    
    res.json({
        message: "Data recieved successfully!",
        originalUrl: urlToShorten,
        shortUrl: `http://localhost:${PORT}/${shortCode}`
    });
});

app.get('/:shortCode', (req,res) => {
    const code = req.params.shortCode;

    if (Object.hasOwn(map,code)){
        res.redirect(map[code]);
    }else{
        res.status(404).json({error: "Short link not found"});
    }
});


// Boot up the server and listen for connections
app.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});