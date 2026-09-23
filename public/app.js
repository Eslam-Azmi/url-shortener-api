// --- URL SHORTENING LOGIC ---
const form = document.getElementById('shorten-form');
const urlInput = document.getElementById('long-url');
const resultCard = document.getElementById('result-card');
const successData = document.getElementById('success-data');
const errorText = document.getElementById('error-message');
const shortUrlLink = document.getElementById('short-url');

form.addEventListener('submit', async (e) => {
    // Prevent the page from refreshing when the user clicks submit
    e.preventDefault(); 
    
    // Reset UI
    resultCard.classList.add('hidden');
    successData.classList.add('hidden');
    errorText.innerText = '';

    const longUrl = urlInput.value;

    try {
        // Make the HTTP request to your backend
        const response = await fetch('/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ longUrl: longUrl })
        });

        const data = await response.json();

        resultCard.classList.remove('hidden');

        if (!response.ok) {
            // Handle rate limits (429) or invalid URLs (400)
            errorText.innerText = data.error || data.message || "Something went wrong";
        } else {
            // Handle success
            successData.classList.remove('hidden');
            shortUrlLink.href = data.shortUrl;
            shortUrlLink.innerText = data.shortUrl;
        }
    } catch (err) {
        resultCard.classList.remove('hidden');
        errorText.innerText = "Network error. Is the server running?";
    }
});

// --- ANALYTICS / STATUS LOGIC ---
const statusForm = document.getElementById('status-form');
const statusCodeInput = document.getElementById('short-code-input');
const statusResult = document.getElementById('status-result');
const statusData = document.getElementById('status-data');
const statusError = document.getElementById('status-error');
const statOriginal = document.getElementById('stat-original');
const statClicks = document.getElementById('stat-clicks');
const activityList = document.getElementById('activity-list');

statusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Reset UI
    statusResult.classList.remove('hidden');
    statusData.classList.add('hidden');
    statusError.innerText = '';
    activityList.innerHTML = ''; 

    const code = statusCodeInput.value.trim();

    try {
        const response = await fetch(`/status/${code}`);
        const data = await response.json();

        if (!response.ok) {
            statusError.innerText = data.error || "Something went wrong";
        } else {
            statusData.classList.remove('hidden');
            statOriginal.innerText = data.url.original_url;
            statClicks.innerText = data.url.clicks;

            // Loop through the recent activity and create list items
            if (data.recent_activity.length === 0) {
                activityList.innerHTML = "<li>No clicks yet.</li>";
            } else {
                data.recent_activity.forEach(click => {
                    const li = document.createElement('li');
                    li.style.borderBottom = "1px solid #444";
                    li.style.padding = "5px 0";
                    // Format the date to look nice
                    const date = new Date(click.clicked_at).toLocaleString();
                    li.innerText = `${date} - ${click.ip_country} - ${click.user_agent}`;
                    activityList.appendChild(li);
                });
            }
        }
    } catch (err) {
        statusError.innerText = "Network error. Is the server running?";
    }
});