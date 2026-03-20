// Simple end-to-end test for API surface (Phase 2 MVP)

async function run() {
  // 1) login as admin
  const loginRes = await fetch('http://localhost:5000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'admin' })
  })
  const login = await loginRes.json()
  const token = login.token
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

  function show(res) {
    return res.json().then(j => j)
  }

  // 2) list risks
  console.log('Listing risks...')
  let res = await fetch('http://localhost:5000/api/risks', { headers, method: 'GET' })
  console.log('list:', await res.json())

  // 3) create risk
  console.log('Creating risk...')
  res = await fetch('http://localhost:5000/api/risks', { method: 'POST', headers, body: JSON.stringify({ name: 'Risk A', description: 'demo' }) })
  const created = await res.json()
  console.log('created:', created)
  const id = created?.data?.id || 1

  // 4) get by id
  res = await fetch(`http://localhost:5000/api/risks/${id}`, { headers, method: 'GET' })
  console.log('get by id:', await res.json())

  // 5) update
  res = await fetch(`http://localhost:5000/api/risks/${id}`, { method: 'PUT', headers, body: JSON.stringify({ name: 'Risk A Updated', description: 'updated' }) })
  console.log('update:', await res.json())

  // 6) delete
  res = await fetch(`http://localhost:5000/api/risks/${id}`, { method: 'DELETE', headers })
  console.log('delete:', await res.json())

  // 7) get after delete
  res = await fetch(`http://localhost:5000/api/risks/${id}`, { headers, method: 'GET' })
  console.log('get after delete:', await res.json())

  // 8) test viewer RBAC
  const loginViewer = await fetch('http://localhost:5000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'viewer' })
  })
  const viewer = await loginViewer.json()
  const viewerToken = viewer.token
  const viewerHeaders = { 'Authorization': `Bearer ${viewerToken}`, 'Content-Type': 'application/json' }
  res = await fetch(`http://localhost:5000/api/risks/2`, { method: 'DELETE', headers: viewerHeaders })
  console.log('viewer delete attempt status:', res.status, await res.text())

  // 9) health check
  res = await fetch('http://localhost:5000/health', { headers: viewerHeaders })
  console.log('health (viewer):', await res.json())
}

run().then(() => console.log('TEST_FINISHED')).catch(err => { console.error('TEST_ERROR', err); process.exit(1) })
