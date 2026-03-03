const pool = require("../database/pool");

async function insertusers(fname,lname,gender,email,phn,pass,role) {
    const result = await pool.query(
        "insert into users(fname,lname,gender,email,phone,password,role) values($1,$2,$3,$4,$5,$6,$7)",
        [fname,lname,gender,email,phn,pass,role]
    );
    return result.rows[0];
};
module.exports = {insertusers};