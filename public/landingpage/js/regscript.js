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
const openModal = document.getElementById("openModal");
const closeModal = document.getElementById("closeModal");
const modal = document.getElementById("modalOverlay");
const redirectBtn = document.getElementById("redirectBtn");
const nameRegex = /^[A-Za-z]+$/;
const specialChar = /[!@#$%^&*]/;
const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;

form.addEventListener("submit", async function (e) {

    e.preventDefault();
    message.innerHTML = "";

    try {
        if (!fname.value.trim()) {
        message.textContent = "First name required";
        return;
        }
        if (!nameRegex.test(fname.value)) {
        message.textContent = "Name must contain only letters";
        return;
        }

        if (!lname.value.trim()) {
            message.textContent = "Last name required";
            return;
        }
        if (!nameRegex.test(lname.value)) {
        message.textContent = "Name must contain only letters";
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

        if (pass.value.length < 8) {
            message.textContent = "Password must be at least 8 characters";
            return;
        }

        if (pass.value !== confirmPass.value) {
            message.textContent = "Passwords do not match";
            return;
        }
        if(!specialChar.test(confirmPass.value)){
            message.textContent = "Atleast 1 special character needed";
            return;
        }

        if ((phn.value && isNaN(phn.value)) || phn.value.length != 10) {
            message.textContent = "Invalid Phone Number";
            return;
        }
        if(specialCharRegex.test(phn.value)){
            message.textContent = "Invalid Phone Number";
            return;
        }

        const res = await fetch("/register", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({
                    firstname:fname.value,
                    lastname :lname.value,
                    gender :gender.value,
                    email : email.value,
                    phn : phn.value,
                    pass : pass.value,
                    role : role.value
            })
        });
        const data = await res.json();

        if(!res.ok){
            throw new Error(data.error);
        }
        modal.style.display = "flex";

    } catch (err) {
        message.textContent = err.message;
    }

});
    
/*==================*/
/*Overlay Buttons*/
/*==================*/

redirectBtn.addEventListener("click", () => {
    window.location.href = "/loginpage";
});

/*==================*/
/* password toggle */
/*==================*/
function togglePass() {

    const checkbox = document.getElementById("pass-checkbox");

    if (checkbox.checked) {
        pass.type = "text";
        confirmPass.type = "text";
    } else {
        pass.type = "password";
        confirmPass.type = "password";
    }

}
