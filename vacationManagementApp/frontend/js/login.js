const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

form.addEventListener("submit", async(e) => {
    e.preventDefault();
    const personal_id = document.getElementById("personal_id").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch("http://192.168.41.101:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personal_id, password })
        });

        const data = await res.json();

        if (!res.ok) {
            // სერვერისგან წამოსული მესიჯი აჩვენოს
            errorMsg.textContent = data.message || "შეცდომა ავტორიზაციისას";
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);

        // Redirect based on role
        if (data.role === "Admin") window.location.href = "admin.html";
        else if (data.role === "Validator") window.location.href = "validator.html";
        else window.location.href = "client.html";

    } catch (err) {
        errorMsg.textContent = "სერვერთან კავშირის პრობლემა";
        console.error("Login error:", err);
    }
});