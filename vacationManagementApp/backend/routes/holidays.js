//backend/routes/holideys.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { auth } = require("../middleware/auth");

// მხოლოდ Admin-ს აქვს წვდომა
//router.use(auth("Admin"));

// Get all holidays
router.get("/", async(req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, name FROM holidays ORDER BY date ASC"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add holiday
router.post("/", async(req, res) => {
    try {
        const { date, name } = req.body;
        await db.query("INSERT INTO holidays (date, name) VALUES (?, ?)", [date || null, name]);
        res.json({ message: "Holiday added" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update holiday
router.put("/:id", async(req, res) => {
    try {
        const { date, name } = req.body;
        await db.query("UPDATE holidays SET date = ?, name = ? WHERE id = ?", [date || null, name, req.params.id]);
        res.json({ message: "Holiday updated" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete holiday
router.delete("/:id", async(req, res) => {
    try {
        await db.query("DELETE FROM holidays WHERE id = ?", [req.params.id]);
        res.json({ message: "Holiday removed" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;