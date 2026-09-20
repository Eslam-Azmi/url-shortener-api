require('dotenv').config();
const { Pool } = require('pg');

const express = require('express');
const app = express();
const PORT = 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.connect()
    .then(() => console.log("Connected to PostgreSQL successfully!"))
    .catch(err => console.error("Database connection error", err.stack));


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

app.post('/shorten',async (req, res) => {
    const urlToShorten = req.body.longUrl;

    try {
        new URL(urlToShorten);
    }catch(err){
        return res.status(400).json({error: "Invalid URL format. Must include http:// or https://"});
    }

    try {
        const old = await pool.query('SELECT short_code FROM urls WHERE original_url = $1', [urlToShorten]);

        if (old.rows.length > 0){
            const oldShortCode = old.rows[0].short_code;
            return res.json({
                message: "You already shortened that link",
                originalUrl: urlToShorten,
                shortUrl: `http://localhost:${PORT}/${oldShortCode}`
            });
        }

        let shortCode = randomGenerator();
        let isCollision = true;
        
        while (isCollision){
            const result = await pool.query('SELECT short_code FROM urls WHERE short_code = $1', [shortCode]);
            
            if (result.rows.length === 0) {
                isCollision = false;
            }else{
                shortCode = randomGenerator();
            }
        }
        await pool.query('INSERT INTO urls (short_code, original_url) VALUES ($1, $2)', [shortCode, urlToShorten]);

        res.json({
            message: "Data successfully saved to database!",
            originalUrl: urlToShorten,
            shortUrl: `http://localhost:${PORT}/${shortCode}`
        });
    }catch(error){
        console.error(error);
        res.status(500).json({error: "Server encountered database error"});
    }
});

app.get('/:shortCode',async (req,res) => {
    const code = req.params.shortCode;

    try {
        const result = await pool.query('UPDATE urls SET clicks = clicks+1 WHERE short_code = $1 RETURNING original_url', [code]);
        if (result.rows.length > 0){
            res.redirect(result.rows[0].original_url)
        }else{
            res.status(404).json({error: "Short link not found"})
        }
    }catch(error){
        console.error(error);
        res.status(500).json({error: "Server encountered database error"});
    }
});

app.get('/status/:shortCode',async (req,res) => {
    const code = req.params.shortCode;

    try {
        const result = await pool.query('SELECT * FROM urls WHERE short_code = $1', [code]);

        if (result.rows.length > 0){
            res.json(result.rows[0]);
        }else{
            res.status(404).json({ error: "Short link not found" });
        }

    }catch(error){
        console.error(error);
        res.status(500).json({error: "Server encountered database error"});
    }
});


app.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
});