// ---- SETTINGS PAGE ----
window.onload = () => {
  const u = getUser();
  // Alleen OPS mag deze pagina zien
  const rollen = (u.rollen || []).map(r => r.naam || r);
  if (!rollen.some(r => r.includes('OPS'))) {
    window.location.href = 'porto.html';
    return;
  }
  laadSpecialisaties();
};

function laadSpecialisaties() {
  fetch(`${API_URL}/api/specialisaties`)
    .then(r => r.json())
    .then(data => {
      document.getElementById('spec-tbody').innerHTML = data.map(s => `
        <tr>
          <td>${s.voertuig}</td>
          <td><input type="number" value="${s.max_eenheden}" min="1" max="99" class="input-field" style="width:80px" id="max-${s.voertuig.replace(/ /g,'_')}" /></td>
          <td><input type="text" value="${s.tijdslot_start || ''}" placeholder="bv. 20:00" class="input-field" style="width:100px" id="tijd-${s.voertuig.replace(/ /g,'_')}" /></td>
          <td><button class="btn-purple small" onclick="slaSpecOp('${s.voertuig}')">Opslaan</button></td>
        </tr>
      `).join('');
    });
}

function slaSpecOp(voertuig) {
  const key = voertuig.replace(/ /g, '_');
  const max = parseInt(document.getElementById(`max-${key}`).value);
  const tijd = document.getElementById(`tijd-${key}`).value.trim() || null;
  fetch(`${API_URL}/api/specialisaties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voertuig, max_eenheden: max, tijdslot_start: tijd }),
  }).then(() => showToast(`${voertuig} opgeslagen`));
}
