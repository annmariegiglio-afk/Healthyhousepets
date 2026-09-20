// Custom Worker entry point for the Healthy House Pets static site.
// Handles the /subscribe route (newsletter signup -> Brevo) and falls
// through to serving the static site for everything else.
//
// Requires an environment variable/secret BREVO_API_KEY.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    // Everything else: serve the static site as-is.
    return env.ASSETS.fetch(request);
  },
};

async function handleSubscribe(request, env) {
  let email;
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      email = body.email;
    } else {
      const formData = await request.formData();
      email = formData.get('email');
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Could not read form data.' }, 400);
  }

  if (!email || typeof email !== 'string' || !isValidEmail(email)) {
    return jsonResponse({ ok: false, error: 'Please enter a valid email address.' }, 400);
  }

  if (!env.BREVO_API_KEY) {
    return jsonResponse({ ok: false, error: 'Server is not configured yet.' }, 500);
  }

  const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      email: email,
      listIds: [4],
      updateEnabled: true, // don't error if the contact already exists
    }),
  });

  if (brevoResponse.ok) {
    return jsonResponse({ ok: true });
  }

  const errorBody = await brevoResponse.json().catch(() => ({}));
  if (errorBody.code === 'duplicate_parameter') {
    return jsonResponse({ ok: true });
  }

  return jsonResponse(
    { ok: false, error: 'Something went wrong. Please try again.' },
    502
  );
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
