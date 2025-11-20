function isEmail(email = '') {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

function isPasswordStrong(password = '') {
  return typeof password === 'string' && password.length >= 6;
}

module.exports = {
  isEmail,
  isPasswordStrong,
};

