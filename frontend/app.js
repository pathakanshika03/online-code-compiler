const BASE_URL = "http://127.0.0.1:5000";

// Save token
function saveToken(token) {
    localStorage.setItem("token", token);
}

// Get token
function getToken() {
    return localStorage.getItem("token");
}

// Logout
function logout() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("isloggedIn");
    window.location.href = "login.html";
}

// API helper
async function api(url, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };

    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(BASE_URL + url, options);
    return response.json();
}


// -----------------------------
// THEME SWITCHER
// -----------------------------
function applyTheme(name) {
    document.body.classList.remove("theme-vscode", "theme-midnight", "theme-light");

    if (name !== "neon") {
        document.body.classList.add("theme-" + name);
    }

    localStorage.setItem("theme", name);
}

function loadTheme() {
    const saved = localStorage.getItem("theme") || "neon";
    applyTheme(saved);
}

window.onload = function () {
    const saved = localStorage.getItem("theme") || "neon";
    document.body.className = `theme-${saved}`;
};

loadTheme();


//add key for program type in db
//add input field
//logout button handle