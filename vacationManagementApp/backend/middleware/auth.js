//backend/middleware/auth.js
const jwt = require("jsonwebtoken");

// Middleware ფუნქცია role-ის მიხედვით
function auth(requiredRole) {
    return async function(req, res, next) {
        try {
            const header = req.headers["authorization"];
            if (!header) {
                return res.status(401).json({ error: true, message: "Unauthorized: missing header" });
            }

            const parts = header.split(" ");
            if (parts.length !== 2 || parts[0] !== "Bearer") {
                return res.status(401).json({ error: true, message: "Unauthorized: bad format" });
            }

            const token = parts[1];

            jwt.verify(token, "secret_key", (err, user) => {
                if (err) {
                    return res.status(403).json({ error: true, message: "Invalid or expired token" });
                }

                // --- ახალი, array/string მხარდაჭერა ---
                const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
                if (requiredRole && !allowedRoles.includes(user.role) && user.role !== "Admin") {
                    return res.status(403).json({ error: true, message: "Access denied" });
                }

                req.user = user;
                next();
            });

        } catch (err) {
            console.error("Auth middleware error:", err);
            res.status(500).json({ error: true, message: "Server error in auth middleware" });
        }
    };
}

// Admin role helper
function isAdmin(req, res, next) {
    if (!req.user || req.user.role !== "Admin") {
        return res.status(403).json({ error: true, message: "Admin only" });
    }
    next();
}

// Default middleware (user must be authenticated)
const authMiddleware = auth();

module.exports = { authMiddleware, auth, isAdmin };