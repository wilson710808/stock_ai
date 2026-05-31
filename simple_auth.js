const bcrypt = require("bcryptjs");
const users = {
    "admin": { passwordHash: "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.vqBytfRtqJ/pOnO", username: "admin" }
};

exports.checkLogin = async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user) return res.status(401).json({ error: "用戶名或密碼錯誤" });
    
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "用戶名或密碼錯誤" });
    
    req.session.userId = username;
    req.session.username = username;
    res.json({ success: true });
};

exports.requireLogin = (req, res, next) => {
    if (req.session.userId) return next();
    res.redirect("/login.html");
};
