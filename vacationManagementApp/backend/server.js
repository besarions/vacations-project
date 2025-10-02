const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const errorHandler = require("./middleware/errorHandler");

// Routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const validatorRoutes = require("./routes/validator");
const clientRoutes = require("./routes/client");
const holidayRoutes = require("./routes/holidays");
const delaysRouter = require("./routes/delays");
const exportRoutes = require("./routes/export");
const importRoutes = require("./routes/import");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Serve Litepicker static files
//app.use('/static', express.static(path.join(__dirname, "node_modules/litepicker/dist")));

// Serve Flatpickr static files
app.use('/static/flatpickr', express.static(path.join(__dirname, "node_modules/flatpickr/dist")));


// API routes
app.use("/api/auth", authRoutes); // Login + current user
app.use("/api/admin", adminRoutes); // Admin CRUD
app.use("/api/validator", validatorRoutes); // Validator
app.use("/api/client", clientRoutes); // Client personal info + leaves
app.use("/api/holidays", holidayRoutes); // Holidays (Admin only)
// ➕ ახალი route
app.use("/api/delays", delaysRouter);
app.use("/api/export", exportRoutes);
app.use("/api/import", importRoutes);


// Serve static frontend (optional)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Catch-all for frontend routing
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Centralized error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});