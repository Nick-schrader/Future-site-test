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
          <td><input type="text" value="${s.vereiste_rol || ''}" placeholder="bv. Motor" class="input-field" style="width:100px" id="rol-${s.voertuig.replace(/ /g,'_')}" /></td>
          <td><input type="text" value="${s.tijdslot_start || ''}" placeholder="bv. 20:00" class="input-field" style="width:100px" id="tijd-${s.voertuig.replace(/ /g,'_')}" /></td>
          <td><button class="btn-purple small" onclick="slaSpecOp('${s.voertuig}')">Opslaan</button></td>
        </tr>
      `).join('');
    });

  // Laad koppel instelling
  fetch(`${API_URL}/api/instellingen-systeem`)
    .then(r => r.json())
    .then(d => {
      if (d.max_koppel) document.getElementById('max-koppel').value = d.max_koppel;
      const toggle = document.getElementById('dc-namen-aan');
      if (toggle) toggle.checked = d.dc_namen_aan !== '0';
    })
    .catch(() => {});
}

function slaSpecOp(voertuig) {
  const key = voertuig.replace(/ /g, '_');
  const max = parseInt(document.getElementById(`max-${key}`).value);
  const rol = document.getElementById(`rol-${key}`).value.trim() || null;
  const tijd = document.getElementById(`tijd-${key}`).value.trim() || null;
  fetch(`${API_URL}/api/specialisaties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voertuig, max_eenheden: max, vereiste_rol: rol, tijdslot_start: tijd }),
  }).then(() => showToast(`${voertuig} opgeslagen`));
}

function slaKoppelOp() {
  const max = parseInt(document.getElementById('max-koppel').value);
  fetch(`${API_URL}/api/instellingen-systeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_koppel: max }),
  }).then(() => showToast('Koppel instelling opgeslagen'));
}

function toggleDcNamen(el) {
  fetch(`${API_URL}/api/instellingen-systeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dc_namen_aan: el.checked ? '1' : '0' }),
  }).then(() => showToast('DC namen ' + (el.checked ? 'ingeschakeld' : 'uitgeschakeld')));
}

function slaDcFormaatOp() {
  const formaat = document.getElementById('dc-formaat').value.trim();
  const formaatNa = document.getElementById('dc-formaat-na').value.trim();
  fetch(`${API_URL}/api/instellingen-systeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dc_formaat: formaat, dc_formaat_na: formaatNa }),
  }).then(() => showToast('DC naam formaat opgeslagen'));
}
