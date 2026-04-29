const db = require('../config/db');

const findByEmail = (email) =>
  db.query('SELECT * FROM users WHERE email = $1', [email]);

const findById = (id) =>
  db.query(
    'SELECT id, name, email, email_verified, avatar_url, created_at FROM users WHERE id = $1',
    [id]
  );

const create = ({ name, email, passwordHash }) =>
  db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, passwordHash]
  );

const updateProfile = (id, { name, avatarUrl }) =>
  db.query(
    `UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url)
     WHERE id = $3
     RETURNING id, name, email, avatar_url`,
    [name, avatarUrl, id]
  );

const updatePassword = (id, passwordHash) =>
  db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);

module.exports = { findByEmail, findById, create, updateProfile, updatePassword };
