# Prompt for the translator (paste this into Claude together with strings-en.json)

You are a professional translator. Translate the UI text of a small shop-management app for phone repair and electronics shops in Ethiopia from English into **Afaan Oromoo** (Latin/Qubee script, standard Ethiopian Oromo that a shopkeeper in Adama would understand).

I attached `strings-en.json`, a JSON list of English strings.

Rules:
1. Return ONLY one JSON object: each English string exactly as written as the key, its Afaan Oromoo translation as the value. No comments, no markdown text around it.
2. Keep placeholders exactly as they are, e.g. {n}, {d}, {c}, {a}, {b}, {r}, {s}, {l}, {m}, {i}, {t}. Do not translate or rename them. Their order may change if the grammar needs it.
3. Keep these unchanged: Birr, IMEI, Excel, Google Sheets, Telegram, WhatsApp, A to E, +, and any number or symbol.
4. These are buttons, labels and short messages on a phone screen. Keep them short and natural. Use a simple, polite, everyday style, not formal or literary.
5. Use words shopkeepers really use: stock = kuusaa, sale = gurgurtaa, repair = suphaa/hojii suphaa, customer = maamilaa, backup = kuusaa dabalataa (backup), price = gatii, profit = bu'aa, expense = baasii, trade-in = jijjiirraa meeshaa, spare part = kutaa/meeshaa dabalataa. Use the term you think is clearest if you know a better one.
6. Keep the same capitalisation style and the same ending punctuation as the English.
7. Do the whole list. If the answer would be too long, split it into parts of about 130 strings. After each part I will say "next" and you continue from where you stopped. Keep each part valid JSON.

At the very end, tell me in one line any strings you were unsure about.
