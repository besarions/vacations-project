//backend/routes/auth.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require("../middleware/auth");

// POST /api/auth/login
router.post("/login", async(req, res, next) => {
    try {
        const { personal_id, password } = req.body;
        if (!personal_id || !password)
            return res.status(400).json({ message: "personal_id and password are required" });

        const [rows] = await pool.query("SELECT * FROM users WHERE personal_id = ?", [personal_id]);
        if (rows.length === 0) return res.status(404).json({ message: "User not found" });

        const user = rows[0];

        // აქ ვამოწმებთ სტატუსს
        if (user.status !== "active") {
            return res.status(403).json({ message: "თქვენი პროფილი არააქტიურია, გთხოვთ მიმართოთ ადმინისტრატორს." });
        }

        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user.id, role: user.role, personal_id: user.personal_id },
            "secret_key", { expiresIn: "1h" }
        );

        res.json({
            token,
            role: user.role,
            first_name: user.first_name,
            last_name: user.last_name
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;