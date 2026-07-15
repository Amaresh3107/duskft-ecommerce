/**
 * Auth.gs
 * ------------------------------------------------------------------
 * Handles both admin/staff (Users sheet) and customer (Customers sheet)
 * authentication. Sessions are stored in the Sessions sheet and expire
 * after SESSION_TTL_HOURS. The client stores the returned token and
 * sends it back as `token` on every API call.
 * ------------------------------------------------------------------
 */

const SESSION_TTL_HOURS = 24 * 7; // 7 days

/** One-way hash. NOTE: for real production use, add a per-user random
 * salt column instead of a single pepper — this is a skeleton default. */
function hashPassword_(password) {
  const pepper = 'change-this-pepper-in-production';
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + pepper,
    Utilities.Charset.UTF_8
  );
  return digest.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

/**
 * Logs in either a staff/admin user or a customer.
 * accountType: 'staff' | 'customer'
 * Returns { token, user } on success, throws on failure.
 */
function login(email, password, accountType) {
  const sheetName = accountType === 'customer' ? 'Customers' : 'Users';
  const account = DB.query(sheetName, function (r) {
    return r.email && r.email.toLowerCase() === String(email).toLowerCase();
  })[0];

  if (!account) throw new Error('No account found with that email.');
  if (account.status && account.status !== 'active') throw new Error('This account is not active.');
  if (account.passwordHash !== hashPassword_(password)) throw new Error('Incorrect password.');

  const token = Utilities.getUuid();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  DB.insert('Sessions', {
    token: token,
    userId: account.id,
    role: accountType === 'customer' ? 'customer' : account.role,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString()
  }, { noId: true });

  const safeAccount = Object.assign({}, account);
  delete safeAccount.passwordHash;
  return { token: token, user: safeAccount };
}

/** Resolves a session token to { userId, role } or throws if invalid/expired. */
function requireSession_(token) {
  if (!token) throw new Error('Not authenticated.');
  const session = DB.getById('Sessions', token, 'token');
  if (!session) throw new Error('Invalid session.');
  if (new Date(session.expiresAt) < new Date()) {
    DB.remove('Sessions', token, 'token');
    throw new Error('Session expired, please log in again.');
  }
  return session;
}

/** Throws unless the session's role is one of allowedRoles. */
function requireRole_(token, allowedRoles) {
  const session = requireSession_(token);
  if (allowedRoles.indexOf(session.role) === -1) {
    throw new Error('Not authorized for this action.');
  }
  return session;
}

function logout(token) {
  DB.remove('Sessions', token, 'token');
  return { success: true };
}

function registerCustomer(payload) {
  const existing = DB.query('Customers', function (r) {
    return r.email && r.email.toLowerCase() === String(payload.email).toLowerCase();
  })[0];
  if (existing) throw new Error('An account with that email already exists.');

  const customer = DB.insert('Customers', {
    name: payload.name,
    email: payload.email,
    phone: payload.phone || '',
    passwordHash: hashPassword_(payload.password),
    businessName: payload.businessName || '',
    gstNumber: payload.gstNumber || '',
    status: 'active'
  });
  delete customer.passwordHash;
  return login(payload.email, payload.password, 'customer');
}
