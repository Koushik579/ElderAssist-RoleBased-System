const reg_btn = document.getElementById("reg_btn");
const fname = document.getElementById("fname");
const lname = document.getElementById("lname");
const gender = document.getElementById("gender");
const email = document.getElementById("email"); 
const phn = document.getElementById("phn"); 
const pass = document.getElementById("password"); 
const confirmPass =document.getElementById("confirmPassword");
const role = document.getElementById("role"); 
const message = document.getElementById("message");
const form = document.getElementById("registerForm");

form.addEventListener("submit", async function (e) {

    e.preventDefault();
    message.innerHTML = "";

    if (!fname.value.trim()) {
        message.textContent = "First name required";
        return;
    }

    if (!lname.value.trim()) {
        message.textContent = "Last name required";
        return;
    }

    if (gender.value === "select") {
        message.textContent = "Select your gender";
        return;
    }

    if (!email.value.trim()) {
        message.textContent = "Email required";
        return;
    }

    if (pass.value.length < 6) {
        message.textContent = "Password must be at least 6 characters";
        return;
    }

    if (pass.value !== confirmPass.value) {
        message.textContent = "Passwords do not match";
        return;
    }

    if ((phn.value && isNaN(phn.value)) || phn.value.length != 10) {
        message.textContent = "Invalid Phone Number";
        return;
    }

});