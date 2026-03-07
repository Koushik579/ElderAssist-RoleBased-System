const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "elderassist_super_secret";

function authenticateToken(req,res,next){

    const authHeader = req.headers["authorization"];
    let token;

    if (authHeader) {
        const parts = authHeader.split(" ");
        if (parts[0] !== "Bearer" || !parts[1]) {
            return res.status(401).json({ error: "Malformed authorization header" });
        }
        token = parts[1];
    }

    if (!token) {
        const cookieHeader = req.headers.cookie || "";
        const cookieToken = cookieHeader
            .split(";")
            .map(part => part.trim())
            .find(part => part.startsWith("token="));

        if (cookieToken) {
            token = decodeURIComponent(cookieToken.substring("token=".length));
        }
    }

    if (!token) {
        return res.status(401).json({error:"Token required"});
    }

    jwt.verify(token, JWT_SECRET, (err,user)=>{
        if(err){
            return res.status(403).json({error:"Invalid token"});
        }

        req.user = user;
        next();
    });

}

module.exports = authenticateToken;
