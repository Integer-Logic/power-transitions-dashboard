const validateRegistration = (req, res, next) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ 
      message: 'Username, email, and password are required' 
    });
  }
  
  if (username.length < 3) {
    return res.status(400).json({ 
      message: 'Username must be at least 3 characters' 
    });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ 
      message: 'Password must be at least 8 characters' 
    });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      message: 'Invalid email format' 
    });
  }
  
  next();
};

module.exports = { validateRegistration };