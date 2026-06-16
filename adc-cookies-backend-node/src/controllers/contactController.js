import * as contactService from '../services/contactService.js';

export async function submitMessage(req, res) {
  const { name, email, phone, message } = req.body || {};
  const result = await contactService.submitMessage(
    String(name || '').trim(),
    String(email || '').trim(),
    phone ? String(phone).trim() : null,
    String(message || '').trim(),
  );
  res.status(201).json(result);
}
