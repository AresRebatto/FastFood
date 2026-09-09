// Opzioni centralizzate per garantire consistenza tra creazione e cancellazione
const COOKIE_NAME = "token";

const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true in produzione (HTTPS)
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
});

function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, getCookieOptions());
}

function clearAuthCookie(res) {
    const { maxAge, ...clearOptions } = getCookieOptions();
    
    res.clearCookie(COOKIE_NAME, clearOptions);
}

module.exports = {
    setAuthCookie,
    clearAuthCookie,
};