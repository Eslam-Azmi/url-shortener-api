require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { Redis } = require('@upstash/redis');
const { rateLimit } = require('express-rate-limit');
const useragent = require('express-useragent');

// INITIALIZATIONS
const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
pool.connect()
    .then(() => console.log("Connected to PostgreSQL successfully!"))
    .catch(err => console.error("Database connection error", err.stack));

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const limiter = rateLimit ({
    windowMs: 15 * 60 * 1000,  // every 15 minutes
    limit: 100,
    message: "Time limit reached",
    statusCode: 429
})

// MIDDLEWARE
app.use(express.json());
app.use(useragent.express());
app.use(express.static('public')); // Serves the frontend files

// FUNCTIONS
function randomGenerator() {
    const container = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let ans = "";

    for (let i = 0; i < 6; i++){
        ans += container[Math.floor(Math.random() * 62)];
    }

    return ans;
}

// API ROUTES 
// app.get('/', (req, res) => {
//     res.json({ message: "URL Shortener API is up and running!" });
// });

app.post('/shorten',limiter, async (req, res) => {
    const urlToShorten = req.body.longUrl;

    if (!urlToShorten) {
        return res.status(400).json({ error: "Missing longUrl in request body" });
    }

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
                shortUrl: `${req.protocol}://${req.get('host')}/${oldShortCode}`
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
            shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`
        });
    }catch(error){
        console.error(error);
        res.status(500).json({error: "Server encountered database error"});
    }
});

app.get('/:shortCode',async (req,res) => {
    const code = req.params.shortCode;

    try {
        let cachedUrl = null;

        try {
            cachedUrl = await redis.get(code);
        }catch(redisError){
            console.error("Redis GET failure, falling back to PostgreSQL:", redisError.message);
        }

        let redirectedUrl;

        if (cachedUrl){
            redirectedUrl = cachedUrl;

            await pool.query('UPDATE urls SET clicks = clicks+1 WHERE short_code = $1', [code]);
        }else{
            const result = await pool.query('UPDATE urls SET clicks = clicks+1 WHERE short_code = $1 RETURNING original_url', [code]);

            if (result.rows.length === 0){
                return res.status(404).json({error: "Short link not found"});
            }

            redirectedUrl = result.rows[0].original_url;

            try {
                await redis.set(code, redirectedUrl, {ex : 3600});
            } catch(redisError){
                console.error("Redis SET failure, continuing without caching:", redisError.message);
            }
        }
        const referrer = req.get('Referrer') || 'Direct';
        const browser = req.useragent ? `${req.useragent.os} ${req.useragent.browser}` : 'Unknown'
        const country = req.headers['x-vercel-ip-country'] || 'Local'

        await pool.query('INSERT INTO clicks(short_code, referrer, user_agent, ip_country) VALUES ($1, $2, $3, $4)', [code, referrer, browser, country]);

        res.redirect(redirectedUrl);
    }catch(error){
        console.error(error);
        res.status(500).json({error: "Server encountered database error"});
    }
});

app.get('/status/:shortCode',async (req,res) => {
    const code = req.params.shortCode;

    try {
        const result = await pool.query('SELECT * FROM urls WHERE short_code = $1', [code]);

        if (result.rows.length === 0){
            return res.status(404).json({ error: "Short link not found" });
        }

        const analytics = await pool.query('SELECT clicked_at, referrer, user_agent, ip_country FROM clicks WHERE short_code = $1 ORDER BY clicked_at DESC LIMIT 50', [code]);

        res.json({
            url: result.rows[0],
            recent_activity: analytics.rows
        });
    }catch(error){
        console.error(error);
        res.status(500).json({error: "Server encountered database error"});
    }
});


if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is listening on http://localhost:${PORT}`);
    });
}

module.exports = app;