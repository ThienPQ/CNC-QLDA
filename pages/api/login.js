// pages/api/login.js

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { username, password } = req.body;

  const users = {
    banqlda: { password: "123", role: "banqlda" },
    lanhdaoban: { password: "123", role: "lanhdaoban" },
  };

  const user = users[username];
  if (user && user.password === password) {
    res.status(200).json({ success: true, role: user.role });
  } else {
    res.status(401).json({ success: false });
  }
}
