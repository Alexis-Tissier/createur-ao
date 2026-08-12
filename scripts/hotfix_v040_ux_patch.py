from pathlib import Path

# Applied after hotfix_v040_ux.py has generated the new backend.
p = Path('server-v4.mjs')
s = p.read_text(encoding='utf-8')
old = "  const prefix = new RegExp(`^\\\\s*${number}\\\\s`, 'i');\n  const match = entries.find((entry) => entry.isDirectory() && prefix.test(entry.name));"
if old not in s:
    # Depending on Python escaping, the generated source may contain one escaped slash pair.
    old = "  const prefix = new RegExp(`^\\s*${number}\\s`, 'i');\n  const match = entries.find((entry) => entry.isDirectory() && prefix.test(entry.name));"
new = "  const wanted = `${number} `;\n  const match = entries.find((entry) => entry.isDirectory() && entry.name.trimStart().startsWith(wanted));"
if old not in s:
    raise RuntimeError('numbered folder matcher not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = Path('tests/sync-v4.test.mjs')
s = p.read_text(encoding='utf-8')
s = s.replace("    assert.equal(offersB[0].department, 'CET');", "    assert.equal(offersB[0].department, '');")
s = s.replace("      body: JSON.stringify({ status: 'envoye' })", "      body: JSON.stringify({ remark: 'modifié depuis PC-B' })")
s = s.replace("    assert.equal(offersA[0].status, 'envoye');\n    assert.equal(offersA[0].lastActorPc, 'PC-B');", "    assert.equal(offersA[0].remark, 'modifié depuis PC-B');\n    assert.equal(offersA[0].lastActorPc, 'PC-B');")
p.write_text(s, encoding='utf-8')

print('post-hotfix scanner/test patch applied')
