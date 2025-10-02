//frontend/js/delays.js
let client = null;


/* ======================== */
/* Helper Functions         */
/* ======================== */
function showElement(id) {
    document.getElementById(id).style.display = "block";
}

function hideElement(id) {
    document.getElementById(id).style.display = "none";
}

function formatMinutesDiff(startTime, endTime) {
    const diff = (new Date(`1970-01-01T${endTime}`) - new Date(`1970-01-01T${startTime}`)) / 60000;
    return diff > 0 ? diff + " წუთი" : "0";
}

async function fetchJSON(url, options = {}) {
    try {
        const res = await fetch(url, options);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP error ${res.status}`);
        return data;
    } catch (err) {
        console.error(`Fetch error [${url}]:`, err);
        alert(err.message || "სერვერთან კავშირი ვერ მოხერხდა");
        return null;
    }
}

/* ======================== */
/* Search User              */
/* ======================== */
async function searchUser() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) return alert("გთხოვთ შეიყვანოთ მონაცემი");

    const data = await fetchJSON(`/api/admin/users/search?query=${query}`);
    if (!data || data.length === 0) return alert("მომხმარებელი ვერ მოიძებნა");

    client = data[0];
    document.getElementById("userPid").innerText = client.personal_id;
    document.getElementById("userFirst").innerText = client.first_name;
    document.getElementById("userLast").innerText = client.last_name;

    showElement("userInfo");
    showElement("delayForm");
}

/* ======================== */
/* Calculate Durations      */
/* ======================== */
function calcDurations() {
    const start = document.getElementById("scheduled_start_time").value;
    const checkIn = document.getElementById("check_in_time").value;
    const end = document.getElementById("scheduled_end_time").value;
    const checkOut = document.getElementById("check_out_time").value;

    if (start && checkIn) document.getElementById("late_duration").value = formatMinutesDiff(start, checkIn);
    if (end && checkOut) document.getElementById("early_leave_duration").value = formatMinutesDiff(checkOut, end);
}

// Events for auto-calculation
["check_in_time", "check_out_time", "scheduled_start_time", "scheduled_end_time"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
        if (id === "scheduled_start_time") document.getElementById("check_in_time").value = document.getElementById(id).value;
        if (id === "scheduled_end_time") document.getElementById("check_out_time").value = document.getElementById(id).value;
        calcDurations();
    });
});

/* ======================== */
/* Save Delay               */
/* ======================== */
async function saveDelay(e) {
    e.preventDefault();
    if (!client) return alert("აირჩიე თანამშრომელი");

    const payload = {
        user_id: client.id,
        work_date: document.getElementById("work_date").value,
        scheduled_start_time: document.getElementById("scheduled_start_time").value,
        check_in_time: document.getElementById("check_in_time").value,
        scheduled_end_time: document.getElementById("scheduled_end_time").value,
        check_out_time: document.getElementById("check_out_time").value,
        violation_notice: document.getElementById("violation_notice").checked,
        comment: document.getElementById("comment").value
    };

    const data = await fetchJSON("/api/delays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (data) {
        alert("ჩანაწერი დამატებულია ✅");
        loadDelays(); // refresh
    }
}

/* ======================== */
/* Update Leave             */
/* ======================== */
async function updateLeave(id, status) {
    const data = await fetchJSON(`${API_URL}/validator/leave-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ status })
    });

    if (data) {
        alert("შვებულების სტატუსი განახლებულია ✅");
        reloadAll(); // reload all lists
    }
}