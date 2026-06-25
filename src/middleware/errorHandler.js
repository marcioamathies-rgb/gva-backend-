function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);

  if (err.code === '23505') { // Postgres unique violation
    return res.status(409).json({ error: 'A record with these details already exists.' });
  }
  if (err.code === '23503') { // foreign key violation
    return res.status(400).json({ error: 'Related record not found.' });
  }

  const status = err.status || 500;
  const message = status === 500 ? 'Something went wrong on our end. Please try again.' : err.message;
  res.status(status).json({ error: message });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found.' });
}

module.exports = { errorHandler, notFound };
