const express = require ("express");
const path = require("path");
const app = express();
const {insertusers} = require("./repository/repo");

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname, "../public/landingpage/index.html"));
})
app.get("/loginpage", (req,res)=>{
    res.sendFile(path.join(__dirname,"../public/landingpage/loginpage.html"));
});
app.post("/register",async (req,res)=>{
    try {

        const fname = req.body.firstname;
        const lname = req.body.lastname;
        const gender = req.body.gender;
        const email = req.body.email;
        const phn = req.body.phn;
        const pass = req.body.pass;
        const role = req.body.role;

        const insertUsers = await insertusers(fname,lname,gender,email,phn,pass,role);
        res.json(insertUsers); 

    } catch (err) {
        console.error(err);
        res.status(500).json({error : "Database Error"});
    }

});

app.listen(3000,()=>{
    console.log("Server Running.......");
});