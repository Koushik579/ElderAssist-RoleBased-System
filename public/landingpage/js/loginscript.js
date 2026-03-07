const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("pass");
const loginForm = document.querySelector(".loginform");
const email = document.getElementById("email");
const pass = document.getElementById("pass");
const msg = document.getElementById("login-message");

async function redirectIfLoggedIn() {
    try {
        const res = await fetch("/auth/verify", { method: "GET" });
        if (!res.ok) {
            return;
        }

        const data = await res.json();
        if (!data.user || !data.user.role) {
            return;
        }

        if (data.user.role === "USER") {
            window.location.replace("/userdashboard");
            return;
        }
        if (data.user.role === "CAREGIVER") {
            window.location.replace("/caretakerdashboard");
            return;
        }
        window.location.replace("/admindashboard");
    } catch (err) {
        // Ignore network errors and keep user on login page.
    }
}

window.addEventListener("pageshow", redirectIfLoggedIn);
redirectIfLoggedIn();

togglePassword.addEventListener("click", function () {

    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";

    this.classList.toggle("active");

});

loginForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    msg.textContent = "";

    if (!email.value.trim()) {
        msg.textContent = "Email is required";
        return;
    }
    if (!pass.value) {
        msg.textContent = "Password is required";
        return;
    }

    try {
        const res = await fetch("/login",{
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({
                email: email.value.trim(),
                pass: pass.value
            })
        });

        const data = await res.json();

        if(!res.ok){
            msg.textContent = data.error || "Login failed";
            return;
        }

        if (!data.token) {
            msg.textContent = "Login failed";
            return;
        }

        localStorage.setItem("token", data.token);
        
        if(data.role=== "USER"){
            window.location.replace("/userdashboard");
            return;
        }
        if (data.role === "CAREGIVER") {
            window.location.replace("/caretakerdashboard");
            return;
        }
        window.location.replace("/admindashboard");

    } catch (err) {
        msg.textContent = "Something went wrong. Try again.";
    }

});
